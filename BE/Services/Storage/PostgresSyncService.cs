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
        private int _pendingSyncScheduled = 0;

        public bool IsEnabled => _isEnabled;

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

                    // Parse query parameters
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

            try
            {
                Console.WriteLine("[PostgresSync] Testing connection and ensuring database tables exist...");
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                await EnsureTablesExistAsync(conn);

                // Load existing data from Postgres into FileDb
                await PullFromPostgresAsync(conn, fileDb);

                Console.WriteLine("[PostgresSync] Initialization & initial data sync completed successfully!");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PostgresSync] WARNING: Initialization failed: {ex.Message}. Falling back to local FileDb.");
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
                    location VARCHAR(100) DEFAULT ''
                );

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

        private async Task PullFromPostgresAsync(NpgsqlConnection conn, FileDb fileDb)
        {
            // 1. Load Users from Postgres
            var pgUsers = new Dictionary<string, User>(StringComparer.OrdinalIgnoreCase);
            await using (var cmd = new NpgsqlCommand("SELECT id, fullname, email, username, password_hash, password, role, subscription, subscription_date, subscription_expiry, created_at, updated_at, phone, bio, target_role, experience_level, skills, location FROM users;", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    var id = reader.GetString(0);
                    var skillsJson = reader.IsDBNull(16) ? "[]" : reader.GetString(16);
                    List<string> skillsList;
                    try { skillsList = JsonSerializer.Deserialize<List<string>>(skillsJson) ?? new(); }
                    catch { skillsList = new(); }

                    var u = new User
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
                        Location = reader.IsDBNull(17) ? "" : reader.GetString(17)
                    };

                    pgUsers[id] = u;
                }
            }

            // Merge logic:
            // If Postgres already has users, load them into memory
            foreach (var kvp in pgUsers)
            {
                fileDb.Users[kvp.Key] = kvp.Value;
            }

            // If local FileDb has users that Postgres doesn't have yet (e.g., local seed or test accounts), push them up to Neon
            var usersToPush = fileDb.Users.Values.Where(u => !pgUsers.ContainsKey(u.Id)).ToList();
            if (usersToPush.Count > 0)
            {
                Console.WriteLine($"[PostgresSync] Uploading {usersToPush.Count} local-only accounts to Neon...");
                foreach (var u in usersToPush)
                {
                    await UpsertUserInternalAsync(conn, u);
                }
            }

            // 2. Load Sessions from Postgres
            await using (var cmd = new NpgsqlCommand("SELECT id, user_id, job_title, jd_text, cv_text, questions, answers, feedbacks, status, created_at, started_at, report, evaluation, evidence_ledger, ai_snapshot, language FROM sessions;", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
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

                    fileDb.Sessions[id] = sess;
                }
            }

            Console.WriteLine($"[PostgresSync] Successfully synchronized state with Neon Postgres: {fileDb.Users.Count} users, {fileDb.Sessions.Count} sessions in memory.");
        }

        public void EnqueuePush(FileDb fileDb)
        {
            if (!_isEnabled || string.IsNullOrEmpty(_connectionString)) return;

            // Debounce background sync: if a sync is already scheduled, don't flood tasks
            if (Interlocked.CompareExchange(ref _pendingSyncScheduled, 1, 0) == 0)
            {
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await Task.Delay(300); // 300ms debounce
                        await PushToPostgresAsync(fileDb);
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

        public async Task PushToPostgresAsync(FileDb fileDb)
        {
            if (!_isEnabled || string.IsNullOrEmpty(_connectionString)) return;

            await _syncLock.WaitAsync();
            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                // 1. Sync all users
                var usersSnapshot = fileDb.Users.Values.ToList();
                foreach (var user in usersSnapshot)
                {
                    await UpsertUserInternalAsync(conn, user);
                }

                // 2. Sync all sessions
                var sessionsSnapshot = fileDb.Sessions.Values.ToList();
                foreach (var session in sessionsSnapshot)
                {
                    await UpsertSessionInternalAsync(conn, session);
                }

                // 3. Sync all transactions
                var txSnapshot = fileDb.Transactions.ToList();
                foreach (var tx in txSnapshot)
                {
                    await UpsertTransactionInternalAsync(conn, tx);
                }
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

        private static async Task UpsertUserInternalAsync(NpgsqlConnection conn, User user)
        {
            const string sql = @"
                INSERT INTO users (
                    id, fullname, email, username, password_hash, password, role,
                    subscription, subscription_date, subscription_expiry, created_at, updated_at,
                    phone, bio, target_role, experience_level, skills, location
                ) VALUES (
                    @id, @fullname, @email, @username, @password_hash, @password, @role,
                    @subscription, @subscription_date, @subscription_expiry, @created_at, @updated_at,
                    @phone, @bio, @target_role, @experience_level, @skills::jsonb, @location
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
                    location = EXCLUDED.location;
            ";

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
