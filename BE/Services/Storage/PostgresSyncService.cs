using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using backend.Models;
using Npgsql;

namespace backend.Services.Storage
{
    public class PostgresSyncService
    {
        private readonly string? _connectionString;
        private readonly bool _isEnabled;
        private readonly SemaphoreSlim _syncLock = new(1, 1);
        private readonly object _stageLock = new();
        private int _pendingSyncScheduled = 0;
        private DateTime _lastPullUtc = DateTime.MinValue;
        private bool _isInitialized = false;

        // Baseline fingerprints from last cloud sync to detect ONLY genuine web mutations
        private readonly Dictionary<string, string> _lastSyncedUsers = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, string> _lastSyncedSessions = new(StringComparer.OrdinalIgnoreCase);
        private readonly HashSet<string> _lastSyncedTxIds = new(StringComparer.OrdinalIgnoreCase);

        // Staged web mutations waiting to be flushed to Neon Postgres (Flush-before-Pull guarantees zero data loss)
        private readonly Dictionary<string, User> _pendingUpsertUsers = new(StringComparer.OrdinalIgnoreCase);
        private readonly HashSet<string> _pendingDeleteUserIds = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, Session> _pendingUpsertSessions = new(StringComparer.OrdinalIgnoreCase);
        private readonly HashSet<string> _pendingDeleteSessionIds = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, PaymentTransaction> _pendingTransactions = new(StringComparer.OrdinalIgnoreCase);

        public bool IsEnabled => _isEnabled;

        private sealed class UserAuthMeta
        {
            public bool EmailVerified { get; set; } = true;
            public DateTime? EmailVerifiedAt { get; set; }
            public string? EmailVerificationTokenHash { get; set; }
            public DateTime? EmailVerificationTokenExpiresAt { get; set; }
            public string? PasswordResetTokenHash { get; set; }
            public DateTime? PasswordResetTokenExpiresAt { get; set; }
            public string? SecurityStamp { get; set; }
        }

        public PostgresSyncService(string? rawConnectionString)
        {
            _connectionString = NormalizeConnectionString(rawConnectionString);
            _isEnabled = !string.IsNullOrWhiteSpace(_connectionString);

            if (_isEnabled)
            {
                Console.WriteLine("[PostgresSync] Configured with active PostgreSQL/Neon connection string.");
            }
        }

        public static string? NormalizeConnectionString(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;

            var str = raw.Trim();
            if (str.StartsWith("jdbc:", StringComparison.OrdinalIgnoreCase))
            {
                str = str.Substring(5);
            }

            if (str.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase) ||
                str.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    var uri = new Uri(str);
                    var userInfo = uri.UserInfo.Split(':');
                    var user = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "";
                    var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
                    var host = uri.Host;
                    var port = uri.Port > 0 ? uri.Port : 5432;
                    var database = uri.AbsolutePath.TrimStart('/');
                    if (string.IsNullOrWhiteSpace(database)) database = "neondb";

                    var query = uri.Query.TrimStart('?');
                    var queryParams = System.Web.HttpUtility.ParseQueryString(query);
                    if (string.IsNullOrEmpty(user) && !string.IsNullOrEmpty(queryParams["user"]))
                    {
                        user = queryParams["user"];
                    }
                    if (string.IsNullOrEmpty(password) && !string.IsNullOrEmpty(queryParams["password"]))
                    {
                        password = queryParams["password"];
                    }

                    var sslMode = queryParams["sslmode"] ?? "Require";
                    if (string.Equals(sslMode, "require", StringComparison.OrdinalIgnoreCase))
                    {
                        sslMode = "Require";
                    }

                    return $"Host={host};Port={port};Database={database};Username={user};Password={password};SSL Mode={sslMode};Trust Server Certificate=true;";
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[PostgresSync] Warning: Failed to parse URI connection string: {ex.Message}. Using raw string.");
                }
            }

            return str;
        }

        public async Task InitializeAsync(FileDb fileDb)
        {
            if (!_isEnabled || string.IsNullOrEmpty(_connectionString)) return;

            await _syncLock.WaitAsync();
            try
            {
                Console.WriteLine("[PostgresSync] Testing connection and ensuring database tables exist...");
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                await EnsureTablesExistAsync(conn);
                await InitialBootstrapMergeAsync(conn, fileDb);

                _isInitialized = true;
                _lastPullUtc = DateTime.UtcNow;
                Console.WriteLine("[PostgresSync] Initialization & initial data sync completed successfully!");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PostgresSync] WARNING: Initialization failed: {ex.Message}. Falling back to local FileDb.");
            }
            finally
            {
                _syncLock.Release();
            }
        }

        /// <summary>
        /// Safely synchronizes in-memory FileDb with Neon Postgres at runtime:
        /// 1. Flushes any pending web creations/updates/deletions to Neon FIRST (zero data loss).
        /// 2. Pulls latest rows (including manual SQL/Console edits, inserts, and deletes) from Neon into FileDb.
        /// 3. Preserves active guest_* sessions in memory.
        /// </summary>
        public async Task RefreshFromPostgresAsync(FileDb fileDb, TimeSpan? minInterval = null)
        {
            if (!_isEnabled || string.IsNullOrEmpty(_connectionString) || !_isInitialized) return;

            bool hasPendingLocal;
            lock (_stageLock)
            {
                hasPendingLocal = HasPendingChangesUnlocked();
            }

            if (!hasPendingLocal && minInterval.HasValue && (DateTime.UtcNow - _lastPullUtc) < minInterval.Value)
            {
                return;
            }

            await _syncLock.WaitAsync();
            try
            {
                // Re-check inside lock in case a concurrent caller just refreshed
                lock (_stageLock)
                {
                    hasPendingLocal = HasPendingChangesUnlocked();
                }

                if (!hasPendingLocal && minInterval.HasValue && (DateTime.UtcNow - _lastPullUtc) < minInterval.Value)
                {
                    return;
                }

                // Capture any un-staged RAM changes before pulling
                StageLocalChanges(fileDb);

                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                // STEP 1: Flush all pending Web mutations to Neon FIRST so zero new data can be lost
                await FlushPendingToPostgresInternalAsync(conn);

                // STEP 2: Read authoritative state from Neon Postgres
                var pgUsers = await ReadUsersFromPostgresAsync(conn);
                var pgSessions = await ReadSessionsFromPostgresAsync(conn);
                var pgTransactions = await ReadTransactionsFromPostgresAsync(conn);

                // STEP 3: Apply authoritative Neon state into FileDb memory atomically (preserving active guest sessions)
                fileDb.WithLock(() =>
                {
                    // Reconcile Users (add, update, and remove deleted)
                    foreach (var kvp in pgUsers)
                    {
                        fileDb.Users[kvp.Key] = kvp.Value;
                    }
                    var removedUserKeys = fileDb.Users.Keys.Where(k => !pgUsers.ContainsKey(k)).ToList();
                    foreach (var removedKey in removedUserKeys)
                    {
                        fileDb.Users.TryRemove(removedKey, out _);
                    }

                    // Reconcile Sessions (preserve active guest_* sessions in RAM; sync registered user sessions with Neon)
                    foreach (var kvp in pgSessions)
                    {
                        fileDb.Sessions[kvp.Key] = kvp.Value;
                    }
                    var removedSessionKeys = fileDb.Sessions
                        .Where(kvp => !pgSessions.ContainsKey(kvp.Key) && !IsGuestSession(kvp.Value))
                        .Select(kvp => kvp.Key)
                        .ToList();
                    foreach (var removedSid in removedSessionKeys)
                    {
                        fileDb.Sessions.TryRemove(removedSid, out _);
                    }

                    // Reconcile Transactions
                    fileDb.Transactions = new ConcurrentBag<PaymentTransaction>(pgTransactions);

                    // Update baseline fingerprints
                    RebuildSnapshotsUnlocked(fileDb);
                });

                fileDb.SaveLocalFileOnly();
                _lastPullUtc = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PostgresSync] Warning during runtime refresh from Neon: {ex.Message}");
            }
            finally
            {
                _syncLock.Release();
            }
        }

        private static bool IsGuestSession(Session? s)
        {
            if (s == null || string.IsNullOrWhiteSpace(s.UserId)) return true;
            return s.UserId.StartsWith("guest_", StringComparison.OrdinalIgnoreCase);
        }

        private bool HasPendingChangesUnlocked()
        {
            return _pendingUpsertUsers.Count > 0
                || _pendingDeleteUserIds.Count > 0
                || _pendingUpsertSessions.Count > 0
                || _pendingDeleteSessionIds.Count > 0
                || _pendingTransactions.Count > 0;
        }

        private void StageLocalChanges(FileDb fileDb)
        {
            if (!_isInitialized) return;

            lock (_stageLock)
            {
                // 1. Diff Users
                var currentUsers = fileDb.Users.ToArray();
                var currentUserMap = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var kvp in currentUsers)
                {
                    currentUserMap.Add(kvp.Key);
                    var fp = SerializeFingerprint(kvp.Value);
                    if (!_lastSyncedUsers.TryGetValue(kvp.Key, out var oldFp) || !string.Equals(oldFp, fp, StringComparison.Ordinal))
                    {
                        var cloned = JsonSerializer.Deserialize<User>(fp);
                        if (cloned != null)
                        {
                            _pendingUpsertUsers[kvp.Key] = cloned;
                            _pendingDeleteUserIds.Remove(kvp.Key);
                            _lastSyncedUsers[kvp.Key] = fp;
                        }
                    }
                }

                var deletedUsers = _lastSyncedUsers.Keys.Where(id => !currentUserMap.Contains(id)).ToList();
                foreach (var delId in deletedUsers)
                {
                    _pendingDeleteUserIds.Add(delId);
                    _pendingUpsertUsers.Remove(delId);
                    _lastSyncedUsers.Remove(delId);
                }

                // 2. Diff Sessions (registered users only)
                var currentSessions = fileDb.Sessions.ToArray();
                var currentSessMap = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var kvp in currentSessions)
                {
                    if (IsGuestSession(kvp.Value) || !currentUserMap.Contains(kvp.Value.UserId))
                    {
                        continue;
                    }

                    currentSessMap.Add(kvp.Key);
                    var fp = SerializeFingerprint(kvp.Value);
                    if (!_lastSyncedSessions.TryGetValue(kvp.Key, out var oldFp) || !string.Equals(oldFp, fp, StringComparison.Ordinal))
                    {
                        var cloned = JsonSerializer.Deserialize<Session>(fp);
                        if (cloned != null)
                        {
                            _pendingUpsertSessions[kvp.Key] = cloned;
                            _pendingDeleteSessionIds.Remove(kvp.Key);
                            _lastSyncedSessions[kvp.Key] = fp;
                        }
                    }
                }

                var deletedSessions = _lastSyncedSessions.Keys.Where(id => !currentSessMap.Contains(id)).ToList();
                foreach (var delSid in deletedSessions)
                {
                    _pendingDeleteSessionIds.Add(delSid);
                    _pendingUpsertSessions.Remove(delSid);
                    _lastSyncedSessions.Remove(delSid);
                }

                // 3. Diff Transactions
                foreach (var tx in fileDb.Transactions.ToArray())
                {
                    if (string.IsNullOrWhiteSpace(tx.User) || !currentUserMap.Contains(tx.User))
                    {
                        continue;
                    }
                    var txKey = GetTransactionKey(tx);
                    if (!_lastSyncedTxIds.Contains(txKey))
                    {
                        _pendingTransactions[txKey] = tx;
                        _lastSyncedTxIds.Add(txKey);
                    }
                }
            }
        }

        private void RebuildSnapshotsUnlocked(FileDb fileDb)
        {
            lock (_stageLock)
            {
                _lastSyncedUsers.Clear();
                foreach (var kvp in fileDb.Users)
                {
                    _lastSyncedUsers[kvp.Key] = SerializeFingerprint(kvp.Value);
                }

                _lastSyncedSessions.Clear();
                foreach (var kvp in fileDb.Sessions)
                {
                    if (!IsGuestSession(kvp.Value) && fileDb.Users.ContainsKey(kvp.Value.UserId))
                    {
                        _lastSyncedSessions[kvp.Key] = SerializeFingerprint(kvp.Value);
                    }
                }

                _lastSyncedTxIds.Clear();
                foreach (var tx in fileDb.Transactions)
                {
                    _lastSyncedTxIds.Add(GetTransactionKey(tx));
                }
            }
        }

        private static string SerializeFingerprint<T>(T obj)
        {
            return JsonSerializer.Serialize(obj);
        }

        private static string GetTransactionKey(PaymentTransaction tx)
        {
            if (!string.IsNullOrWhiteSpace(tx.TransactionId)) return tx.TransactionId;
            return $"tx_{tx.User}_{tx.Amount}_{tx.Timestamp}";
        }

        private async Task FlushPendingToPostgresInternalAsync(NpgsqlConnection conn)
        {
            List<string> delSids;
            List<string> delUids;
            List<User> upsertUsers;
            List<Session> upsertSessions;
            List<PaymentTransaction> insertTxs;

            lock (_stageLock)
            {
                if (!HasPendingChangesUnlocked()) return;

                delSids = _pendingDeleteSessionIds.ToList();
                delUids = _pendingDeleteUserIds.ToList();
                upsertUsers = _pendingUpsertUsers.Values.ToList();
                upsertSessions = _pendingUpsertSessions.Values.ToList();
                insertTxs = _pendingTransactions.Values.ToList();

                _pendingDeleteSessionIds.Clear();
                _pendingDeleteUserIds.Clear();
                _pendingUpsertUsers.Clear();
                _pendingUpsertSessions.Clear();
                _pendingTransactions.Clear();
            }

            foreach (var sid in delSids)
            {
                await using var cmd = new NpgsqlCommand("DELETE FROM sessions WHERE id = @id;", conn);
                cmd.Parameters.AddWithValue("id", sid);
                await cmd.ExecuteNonQueryAsync();
            }

            foreach (var uid in delUids)
            {
                await using var cmd = new NpgsqlCommand("DELETE FROM users WHERE id = @id;", conn);
                cmd.Parameters.AddWithValue("id", uid);
                await cmd.ExecuteNonQueryAsync();
            }

            foreach (var u in upsertUsers)
            {
                await UpsertUserInternalAsync(conn, u);
            }

            foreach (var s in upsertSessions)
            {
                await UpsertSessionInternalAsync(conn, s);
            }

            foreach (var tx in insertTxs)
            {
                await UpsertTransactionInternalAsync(conn, tx);
            }
        }

        public void EnqueuePush(FileDb fileDb)
        {
            if (!_isEnabled || string.IsNullOrEmpty(_connectionString)) return;

            // Synchronously stage exact diffs on the caller's thread so no mutation can ever be missed
            StageLocalChanges(fileDb);

            if (Interlocked.CompareExchange(ref _pendingSyncScheduled, 1, 0) == 0)
            {
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await Task.Delay(250);
                        await FlushStagedChangesAsync();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[PostgresSync] Background sync error: {ex.Message}");
                    }
                    finally
                    {
                        Interlocked.Exchange(ref _pendingSyncScheduled, 0);
                    }
                });
            }
        }

        public async Task FlushStagedChangesAsync()
        {
            if (!_isEnabled || string.IsNullOrEmpty(_connectionString)) return;

            bool hasPending;
            lock (_stageLock)
            {
                hasPending = HasPendingChangesUnlocked();
            }
            if (!hasPending) return;

            await _syncLock.WaitAsync();
            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();
                await FlushPendingToPostgresInternalAsync(conn);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PostgresSync] Error flushing staged changes to Neon: {ex.Message}");
            }
            finally
            {
                _syncLock.Release();
            }
        }

        /// <summary>
        /// Full push used ONLY by explicit CLI sync (--sync-neon).
        /// </summary>
        public async Task PushToPostgresAsync(FileDb fileDb)
        {
            if (!_isEnabled || string.IsNullOrEmpty(_connectionString)) return;

            await _syncLock.WaitAsync();
            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                var usersSnapshot = fileDb.Users.Values.ToList();
                foreach (var user in usersSnapshot)
                {
                    await UpsertUserInternalAsync(conn, user);
                }

                var sessionsSnapshot = fileDb.Sessions.Values
                    .Where(s => !string.IsNullOrWhiteSpace(s.UserId) && fileDb.Users.ContainsKey(s.UserId))
                    .ToList();
                foreach (var session in sessionsSnapshot)
                {
                    await UpsertSessionInternalAsync(conn, session);
                }

                var txSnapshot = fileDb.Transactions
                    .Where(tx => !string.IsNullOrWhiteSpace(tx.User) && fileDb.Users.ContainsKey(tx.User))
                    .ToList();
                foreach (var tx in txSnapshot)
                {
                    await UpsertTransactionInternalAsync(conn, tx);
                }

                RebuildSnapshotsUnlocked(fileDb);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PostgresSync] Error pushing data to Neon: {ex.Message}");
            }
            finally
            {
                _syncLock.Release();
            }
        }

        private static async Task EnsureTablesExistAsync(NpgsqlConnection conn)
        {
            const string ddl = @"
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(50) PRIMARY KEY,
                    fullname VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    username VARCHAR(100) NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    password TEXT DEFAULT '',
                    role VARCHAR(20) NOT NULL DEFAULT 'user',
                    subscription VARCHAR(20) NOT NULL DEFAULT 'free',
                    subscription_date TIMESTAMPTZ NULL,
                    subscription_expiry TIMESTAMPTZ NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ NULL,
                    phone VARCHAR(20) DEFAULT '',
                    bio TEXT DEFAULT '',
                    target_role VARCHAR(100) DEFAULT '',
                    experience_level VARCHAR(50) DEFAULT '',
                    skills JSONB DEFAULT '[]'::jsonb,
                    location VARCHAR(100) DEFAULT '',
                    auth_meta JSONB DEFAULT '{}'::jsonb
                );
                ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_meta JSONB DEFAULT '{}'::jsonb;

                CREATE TABLE IF NOT EXISTS sessions (
                    id VARCHAR(50) PRIMARY KEY,
                    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    job_title VARCHAR(255) NOT NULL,
                    jd_text TEXT,
                    cv_text TEXT,
                    questions JSONB DEFAULT '[]'::jsonb,
                    answers JSONB DEFAULT '[]'::jsonb,
                    feedbacks JSONB DEFAULT '[]'::jsonb,
                    status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    started_at TIMESTAMPTZ NULL,
                    report JSONB NULL,
                    evaluation JSONB NULL,
                    evidence_ledger JSONB NULL,
                    ai_snapshot JSONB NULL,
                    language VARCHAR(10) DEFAULT 'vi'
                );

                CREATE TABLE IF NOT EXISTS payment_transactions (
                    id VARCHAR(50) PRIMARY KEY,
                    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    method VARCHAR(50) NOT NULL,
                    amount INT NOT NULL,
                    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
                    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    card_last4 VARCHAR(4) NULL,
                    card_name VARCHAR(100) NULL,
                    transaction_id VARCHAR(100) NULL
                );

                CREATE TABLE IF NOT EXISTS ai_configurations (
                    id VARCHAR(50) PRIMARY KEY,
                    provider VARCHAR(100) NOT NULL,
                    base_url TEXT NOT NULL,
                    model VARCHAR(100) NOT NULL,
                    api_key TEXT NULL,
                    enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    temperature FLOAT NOT NULL DEFAULT 0.7,
                    max_tokens INT NOT NULL DEFAULT 1000,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS candidate_cvs (
                    id VARCHAR(50) PRIMARY KEY,
                    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    file_name VARCHAR(255) NOT NULL,
                    summary TEXT NOT NULL,
                    key_skills JSONB DEFAULT '[]'::jsonb,
                    experience_summary TEXT NOT NULL,
                    raw_text TEXT NULL,
                    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            ";

            await using var cmd = new NpgsqlCommand(ddl, conn);
            await cmd.ExecuteNonQueryAsync();
        }

        private async Task InitialBootstrapMergeAsync(NpgsqlConnection conn, FileDb fileDb)
        {
            var pgUsers = await ReadUsersFromPostgresAsync(conn);
            var pgSessions = await ReadSessionsFromPostgresAsync(conn);
            var pgTransactions = await ReadTransactionsFromPostgresAsync(conn);

            if (pgUsers.Count > 0)
            {
                // Neon already has production users -> Neon is authoritative; only upload brand-new local seed accounts if any
                var localOnlyUsers = fileDb.Users.Values.Where(u => !pgUsers.ContainsKey(u.Id)).ToList();
                if (localOnlyUsers.Count > 0)
                {
                    Console.WriteLine($"[PostgresSync] Uploading {localOnlyUsers.Count} local-only accounts to Neon...");
                    foreach (var u in localOnlyUsers)
                    {
                        await UpsertUserInternalAsync(conn, u);
                        pgUsers[u.Id] = u;
                    }
                }

                fileDb.Users.Clear();
                foreach (var kvp in pgUsers)
                {
                    fileDb.Users[kvp.Key] = kvp.Value;
                }
            }
            else
            {
                // Empty Neon DB -> push initial bootstrap users
                foreach (var u in fileDb.Users.Values)
                {
                    await UpsertUserInternalAsync(conn, u);
                }
            }

            // Reconcile Sessions
            var localOnlySessions = fileDb.Sessions.Values
                .Where(s => !pgSessions.ContainsKey(s.Id) && !IsGuestSession(s) && fileDb.Users.ContainsKey(s.UserId))
                .ToList();
            if (localOnlySessions.Count > 0)
            {
                Console.WriteLine($"[PostgresSync] Uploading {localOnlySessions.Count} local-only sessions to Neon...");
                foreach (var s in localOnlySessions)
                {
                    await UpsertSessionInternalAsync(conn, s);
                    pgSessions[s.Id] = s;
                }
            }

            foreach (var kvp in pgSessions)
            {
                fileDb.Sessions[kvp.Key] = kvp.Value;
            }

            // Reconcile Transactions
            if (pgTransactions.Count > 0)
            {
                fileDb.Transactions = new ConcurrentBag<PaymentTransaction>(pgTransactions);
            }
            else
            {
                foreach (var tx in fileDb.Transactions.Where(t => !string.IsNullOrWhiteSpace(t.User) && fileDb.Users.ContainsKey(t.User)))
                {
                    await UpsertTransactionInternalAsync(conn, tx);
                }
            }

            RebuildSnapshotsUnlocked(fileDb);
            Console.WriteLine($"[PostgresSync] Successfully synchronized state with Neon Postgres: {fileDb.Users.Count} users, {fileDb.Sessions.Count} sessions in memory.");
        }

        private static async Task<Dictionary<string, User>> ReadUsersFromPostgresAsync(NpgsqlConnection conn)
        {
            var pgUsers = new Dictionary<string, User>(StringComparer.OrdinalIgnoreCase);
            const string sql = "SELECT id, fullname, email, username, password_hash, password, role, subscription, subscription_date, subscription_expiry, created_at, updated_at, phone, bio, target_role, experience_level, skills, location, auth_meta FROM users;";
            await using var cmd = new NpgsqlCommand(sql, conn);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var id = reader.GetString(0);
                var skillsJson = reader.IsDBNull(16) ? "[]" : reader.GetString(16);
                List<string> skillsList;
                try { skillsList = JsonSerializer.Deserialize<List<string>>(skillsJson) ?? new(); }
                catch { skillsList = new(); }

                UserAuthMeta? authMeta = null;
                if (!reader.IsDBNull(18))
                {
                    var authMetaJson = reader.GetString(18);
                    if (!string.IsNullOrWhiteSpace(authMetaJson) && authMetaJson != "{}")
                    {
                        try { authMeta = JsonSerializer.Deserialize<UserAuthMeta>(authMetaJson); }
                        catch { authMeta = null; }
                    }
                }

                pgUsers[id] = new User
                {
                    Id = id,
                    Fullname = reader.IsDBNull(1) ? "" : reader.GetString(1),
                    Email = reader.IsDBNull(2) ? "" : reader.GetString(2),
                    Username = reader.IsDBNull(3) ? "" : reader.GetString(3),
                    PasswordHash = reader.IsDBNull(4) ? "" : reader.GetString(4),
                    Password = reader.IsDBNull(5) ? "" : reader.GetString(5),
                    Role = reader.IsDBNull(6) ? "user" : reader.GetString(6),
                    Subscription = reader.IsDBNull(7) ? "free" : reader.GetString(7),
                    SubscriptionDate = reader.IsDBNull(8) ? null : reader.GetDateTime(8).ToString("o"),
                    SubscriptionExpiry = reader.IsDBNull(9) ? null : reader.GetDateTime(9).ToString("o"),
                    CreatedAt = reader.IsDBNull(10) ? DateTime.UtcNow : reader.GetDateTime(10),
                    UpdatedAt = reader.IsDBNull(11) ? null : reader.GetDateTime(11),
                    Phone = reader.IsDBNull(12) ? "" : reader.GetString(12),
                    Bio = reader.IsDBNull(13) ? "" : reader.GetString(13),
                    TargetRole = reader.IsDBNull(14) ? "" : reader.GetString(14),
                    ExperienceLevel = reader.IsDBNull(15) ? "" : reader.GetString(15),
                    Skills = skillsList,
                    Location = reader.IsDBNull(17) ? "" : reader.GetString(17),
                    EmailVerified = authMeta?.EmailVerified ?? true,
                    EmailVerifiedAt = authMeta?.EmailVerifiedAt,
                    EmailVerificationTokenHash = authMeta?.EmailVerificationTokenHash,
                    EmailVerificationTokenExpiresAt = authMeta?.EmailVerificationTokenExpiresAt,
                    PasswordResetTokenHash = authMeta?.PasswordResetTokenHash,
                    PasswordResetTokenExpiresAt = authMeta?.PasswordResetTokenExpiresAt,
                    SecurityStamp = !string.IsNullOrWhiteSpace(authMeta?.SecurityStamp) ? authMeta!.SecurityStamp! : Guid.NewGuid().ToString("N")
                };
            }
            return pgUsers;
        }

        private static async Task<Dictionary<string, Session>> ReadSessionsFromPostgresAsync(NpgsqlConnection conn)
        {
            var pgSessions = new Dictionary<string, Session>(StringComparer.OrdinalIgnoreCase);
            const string sql = "SELECT id, user_id, job_title, jd_text, cv_text, questions, answers, feedbacks, status, created_at, started_at, report, evaluation, evidence_ledger, ai_snapshot, language FROM sessions;";
            await using var cmd = new NpgsqlCommand(sql, conn);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var id = reader.GetString(0);
                var userId = reader.GetString(1);
                var jobTitle = reader.IsDBNull(2) ? "" : reader.GetString(2);
                var jdText = reader.IsDBNull(3) ? "" : reader.GetString(3);
                var cvText = reader.IsDBNull(4) ? "" : reader.GetString(4);

                var qJson = reader.IsDBNull(5) ? "[]" : reader.GetString(5);
                var aJson = reader.IsDBNull(6) ? "[]" : reader.GetString(6);
                var fJson = reader.IsDBNull(7) ? "[]" : reader.GetString(7);
                var status = reader.IsDBNull(8) ? "in_progress" : reader.GetString(8);
                var createdAt = reader.IsDBNull(9) ? DateTime.UtcNow.ToString("o") : reader.GetDateTime(9).ToString("o");
                var startedAt = reader.IsDBNull(10) ? null : reader.GetDateTime(10).ToString("o");

                var repJson = reader.IsDBNull(11) ? null : reader.GetString(11);
                var evalJson = reader.IsDBNull(12) ? null : reader.GetString(12);
                var evLedgerJson = reader.IsDBNull(13) ? null : reader.GetString(13);
                var aiSnapJson = reader.IsDBNull(14) ? null : reader.GetString(14);
                var lang = reader.IsDBNull(15) ? "vi" : reader.GetString(15);

                var sess = new Session
                {
                    Id = id,
                    UserId = userId,
                    JobTitle = jobTitle,
                    JdText = jdText,
                    CvText = cvText,
                    Status = status,
                    CreatedAt = createdAt,
                    StartedAt = startedAt,
                    Language = lang
                };

                try { sess.Questions = JsonSerializer.Deserialize<List<string>>(qJson) ?? new(); } catch { }
                try { sess.Answers = JsonSerializer.Deserialize<List<AnswerItem>>(aJson) ?? new(); } catch { }
                try { sess.Feedbacks = JsonSerializer.Deserialize<List<string>>(fJson) ?? new(); } catch { }
                if (!string.IsNullOrEmpty(repJson)) { try { sess.Report = JsonSerializer.Deserialize<ReportModel>(repJson); } catch { } }
                if (!string.IsNullOrEmpty(evalJson)) { try { sess.Evaluation = JsonSerializer.Deserialize<FinalInterviewEvaluation>(evalJson); } catch { } }
                if (!string.IsNullOrEmpty(evLedgerJson)) { try { sess.EvidenceLedger = JsonSerializer.Deserialize<backend.Models.AI.EvidenceLedger>(evLedgerJson); } catch { } }
                if (!string.IsNullOrEmpty(aiSnapJson)) { try { sess.AiSnapshot = JsonSerializer.Deserialize<backend.Models.AI.SessionAiSnapshot>(aiSnapJson); } catch { } }

                pgSessions[id] = sess;
            }
            return pgSessions;
        }

        private static async Task<List<PaymentTransaction>> ReadTransactionsFromPostgresAsync(NpgsqlConnection conn)
        {
            var list = new List<PaymentTransaction>();
            const string sql = "SELECT id, user_id, method, amount, currency, timestamp, card_last4, card_name, transaction_id FROM payment_transactions ORDER BY timestamp DESC;";
            await using var cmd = new NpgsqlCommand(sql, conn);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var id = reader.GetString(0);
                list.Add(new PaymentTransaction
                {
                    User = reader.IsDBNull(1) ? "" : reader.GetString(1),
                    Method = reader.IsDBNull(2) ? "VIETQR" : reader.GetString(2),
                    Amount = reader.IsDBNull(3) ? 0 : reader.GetInt32(3),
                    Currency = reader.IsDBNull(4) ? "VND" : reader.GetString(4),
                    Timestamp = reader.IsDBNull(5) ? DateTime.UtcNow.ToString("o") : reader.GetDateTime(5).ToString("o"),
                    CardLast4 = reader.IsDBNull(6) ? null : reader.GetString(6),
                    CardName = reader.IsDBNull(7) ? null : reader.GetString(7),
                    TransactionId = reader.IsDBNull(8) ? id : reader.GetString(8)
                });
            }
            return list;
        }

        private static async Task UpsertUserInternalAsync(NpgsqlConnection conn, User user)
        {
            const string sql = @"
                INSERT INTO users (
                    id, fullname, email, username, password_hash, password, role,
                    subscription, subscription_date, subscription_expiry, created_at, updated_at,
                    phone, bio, target_role, experience_level, skills, location, auth_meta
                ) VALUES (
                    @id, @fullname, @email, @username, @password_hash, @password, @role,
                    @subscription, @subscription_date, @subscription_expiry, @created_at, @updated_at,
                    @phone, @bio, @target_role, @experience_level, @skills::jsonb, @location, @auth_meta::jsonb
                ) ON CONFLICT (id) DO UPDATE SET
                    fullname = EXCLUDED.fullname,
                    email = EXCLUDED.email,
                    username = EXCLUDED.username,
                    password_hash = EXCLUDED.password_hash,
                    password = EXCLUDED.password,
                    role = EXCLUDED.role,
                    subscription = EXCLUDED.subscription,
                    subscription_date = EXCLUDED.subscription_date,
                    subscription_expiry = EXCLUDED.subscription_expiry,
                    updated_at = EXCLUDED.updated_at,
                    phone = EXCLUDED.phone,
                    bio = EXCLUDED.bio,
                    target_role = EXCLUDED.target_role,
                    experience_level = EXCLUDED.experience_level,
                    skills = EXCLUDED.skills,
                    location = EXCLUDED.location,
                    auth_meta = EXCLUDED.auth_meta;
            ";

            var authMeta = new UserAuthMeta
            {
                EmailVerified = user.EmailVerified,
                EmailVerifiedAt = user.EmailVerifiedAt,
                EmailVerificationTokenHash = user.EmailVerificationTokenHash,
                EmailVerificationTokenExpiresAt = user.EmailVerificationTokenExpiresAt,
                PasswordResetTokenHash = user.PasswordResetTokenHash,
                PasswordResetTokenExpiresAt = user.PasswordResetTokenExpiresAt,
                SecurityStamp = user.SecurityStamp
            };

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("id", user.Id);
            cmd.Parameters.AddWithValue("fullname", user.Fullname ?? "");
            cmd.Parameters.AddWithValue("email", user.Email ?? "");
            cmd.Parameters.AddWithValue("username", user.Username ?? "");
            cmd.Parameters.AddWithValue("password_hash", user.PasswordHash ?? "");
            cmd.Parameters.AddWithValue("password", user.Password ?? "");
            cmd.Parameters.AddWithValue("role", user.Role ?? "user");
            cmd.Parameters.AddWithValue("subscription", user.Subscription ?? "free");
            cmd.Parameters.AddWithValue("subscription_date", ParseTimestamp(user.SubscriptionDate));
            cmd.Parameters.AddWithValue("subscription_expiry", ParseTimestamp(user.SubscriptionExpiry));
            cmd.Parameters.AddWithValue("created_at", user.CreatedAt);
            cmd.Parameters.AddWithValue("updated_at", (object?)user.UpdatedAt ?? DBNull.Value);
            cmd.Parameters.AddWithValue("phone", user.Phone ?? "");
            cmd.Parameters.AddWithValue("bio", user.Bio ?? "");
            cmd.Parameters.AddWithValue("target_role", user.TargetRole ?? "");
            cmd.Parameters.AddWithValue("experience_level", user.ExperienceLevel ?? "");
            cmd.Parameters.AddWithValue("skills", JsonSerializer.Serialize(user.Skills ?? new()));
            cmd.Parameters.AddWithValue("location", user.Location ?? "");
            cmd.Parameters.AddWithValue("auth_meta", JsonSerializer.Serialize(authMeta));

            await cmd.ExecuteNonQueryAsync();
        }

        private static async Task UpsertSessionInternalAsync(NpgsqlConnection conn, Session session)
        {
            const string sql = @"
                INSERT INTO sessions (
                    id, user_id, job_title, jd_text, cv_text, questions, answers, feedbacks,
                    status, created_at, started_at, report, evaluation, evidence_ledger, ai_snapshot, language
                ) VALUES (
                    @id, @user_id, @job_title, @jd_text, @cv_text, @questions::jsonb, @answers::jsonb, @feedbacks::jsonb,
                    @status, @created_at, @started_at, @report::jsonb, @evaluation::jsonb, @evidence_ledger::jsonb, @ai_snapshot::jsonb, @language
                ) ON CONFLICT (id) DO UPDATE SET
                    job_title = EXCLUDED.job_title,
                    jd_text = EXCLUDED.jd_text,
                    cv_text = EXCLUDED.cv_text,
                    questions = EXCLUDED.questions,
                    answers = EXCLUDED.answers,
                    feedbacks = EXCLUDED.feedbacks,
                    status = EXCLUDED.status,
                    report = EXCLUDED.report,
                    evaluation = EXCLUDED.evaluation,
                    evidence_ledger = EXCLUDED.evidence_ledger,
                    ai_snapshot = EXCLUDED.ai_snapshot,
                    language = EXCLUDED.language;
            ";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("id", session.Id);
            cmd.Parameters.AddWithValue("user_id", session.UserId);
            cmd.Parameters.AddWithValue("job_title", session.JobTitle ?? "");
            cmd.Parameters.AddWithValue("jd_text", session.JdText ?? "");
            cmd.Parameters.AddWithValue("cv_text", session.CvText ?? "");
            cmd.Parameters.AddWithValue("questions", JsonSerializer.Serialize(session.Questions ?? new()));
            cmd.Parameters.AddWithValue("answers", JsonSerializer.Serialize(session.Answers ?? new()));
            cmd.Parameters.AddWithValue("feedbacks", JsonSerializer.Serialize(session.Feedbacks ?? new()));
            cmd.Parameters.AddWithValue("status", session.Status ?? "in_progress");
            cmd.Parameters.AddWithValue("created_at", ParseTimestamp(session.CreatedAt) is DateTime dt ? dt : DateTime.UtcNow);
            cmd.Parameters.AddWithValue("started_at", ParseTimestamp(session.StartedAt));
            cmd.Parameters.AddWithValue("report", session.Report != null ? JsonSerializer.Serialize(session.Report) : (object)DBNull.Value);
            cmd.Parameters.AddWithValue("evaluation", session.Evaluation != null ? JsonSerializer.Serialize(session.Evaluation) : (object)DBNull.Value);
            cmd.Parameters.AddWithValue("evidence_ledger", session.EvidenceLedger != null ? JsonSerializer.Serialize(session.EvidenceLedger) : (object)DBNull.Value);
            cmd.Parameters.AddWithValue("ai_snapshot", session.AiSnapshot != null ? JsonSerializer.Serialize(session.AiSnapshot) : (object)DBNull.Value);
            cmd.Parameters.AddWithValue("language", session.Language ?? "vi");

            await cmd.ExecuteNonQueryAsync();
        }

        private static async Task UpsertTransactionInternalAsync(NpgsqlConnection conn, PaymentTransaction tx)
        {
            var txId = !string.IsNullOrWhiteSpace(tx.TransactionId)
                ? tx.TransactionId
                : $"tx_{Guid.NewGuid():N}";

            const string sql = @"
                INSERT INTO payment_transactions (
                    id, user_id, method, amount, currency, timestamp, card_last4, card_name, transaction_id
                ) VALUES (
                    @id, @user_id, @method, @amount, @currency, @timestamp, @card_last4, @card_name, @transaction_id
                ) ON CONFLICT (id) DO NOTHING;
            ";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("id", txId);
            cmd.Parameters.AddWithValue("user_id", tx.User ?? "");
            cmd.Parameters.AddWithValue("method", tx.Method ?? "");
            cmd.Parameters.AddWithValue("amount", tx.Amount);
            cmd.Parameters.AddWithValue("currency", tx.Currency ?? "VND");
            cmd.Parameters.AddWithValue("timestamp", ParseTimestamp(tx.Timestamp) is DateTime dt ? dt : DateTime.UtcNow);
            cmd.Parameters.AddWithValue("card_last4", (object?)tx.CardLast4 ?? DBNull.Value);
            cmd.Parameters.AddWithValue("card_name", (object?)tx.CardName ?? DBNull.Value);
            cmd.Parameters.AddWithValue("transaction_id", (object?)tx.TransactionId ?? DBNull.Value);

            await cmd.ExecuteNonQueryAsync();
        }

        private static object ParseTimestamp(string? val)
        {
            if (!string.IsNullOrWhiteSpace(val) && DateTime.TryParse(val, null, System.Globalization.DateTimeStyles.RoundtripKind, out var dt))
            {
                return dt.ToUniversalTime();
            }
            return DBNull.Value;
        }
    }
}
