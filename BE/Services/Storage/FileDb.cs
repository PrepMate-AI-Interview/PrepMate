using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using backend.Models;
using backend.Services.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace backend.Services
{
    public class FileDb
    {
        private readonly string _filePath;
        private readonly object _lock = new object();

        public string FilePath => _filePath;

        public ConcurrentDictionary<string, User> Users { get; set; } = new();
        public ConcurrentDictionary<string, Session> Sessions { get; set; } = new();
        public ConcurrentBag<PaymentTransaction> Transactions { get; set; } = new();
        public ConcurrentDictionary<string, AIConfiguration> AIConfigurations { get; set; } = new();
        public ConcurrentDictionary<string, CandidateCV> CVs { get; set; } = new();
        public ConcurrentDictionary<string, ProviderConnection> ProviderConnections { get; set; } = new();
        public ConcurrentDictionary<string, ModelRegistration> ModelRegistrations { get; set; } = new();
        public ConcurrentDictionary<string, ConfigurationVersion> ConfigurationVersions { get; set; } = new();

        public FileDb(string? filePath = null) : this(null, null, filePath)
        {
        }

        public FileDb(IConfiguration? config, IWebHostEnvironment? env = null, string? explicitPath = null)
        {
            _filePath = ResolveDatabasePath(config, env, explicitPath);

            Console.WriteLine($"[FileDb] Database SSOT path: {_filePath}");

            InitializeStorage(env);
        }

        public static string ResolveDatabasePath(IConfiguration? config, IWebHostEnvironment? env, string? explicitPath = null)
        {
            // 1. Explicit path parameter (takes highest precedence)
            if (!string.IsNullOrWhiteSpace(explicitPath))
            {
                return Path.IsPathRooted(explicitPath)
                    ? Path.GetFullPath(explicitPath)
                    : Path.GetFullPath(Path.Combine(env?.ContentRootPath ?? Directory.GetCurrentDirectory(), explicitPath));
            }

            // 2. DATABASE_FILE_PATH environment variable
            var envDbPath = Environment.GetEnvironmentVariable("DATABASE_FILE_PATH");
            if (!string.IsNullOrWhiteSpace(envDbPath))
            {
                return Path.IsPathRooted(envDbPath)
                    ? Path.GetFullPath(envDbPath)
                    : Path.GetFullPath(Path.Combine(env?.ContentRootPath ?? Directory.GetCurrentDirectory(), envDbPath));
            }

            // 3. Database:FilePath from IConfiguration (handles DATABASE__FILEPATH, DATABASE__FILE_PATH, appsettings.json)
            var configPath = config?["Database:FilePath"]
                ?? Environment.GetEnvironmentVariable("DATABASE__FILEPATH")
                ?? Environment.GetEnvironmentVariable("DATABASE__FILE_PATH");
            if (!string.IsNullOrWhiteSpace(configPath))
            {
                return Path.IsPathRooted(configPath)
                    ? Path.GetFullPath(configPath)
                    : Path.GetFullPath(Path.Combine(env?.ContentRootPath ?? Directory.GetCurrentDirectory(), configPath));
            }

            // 4. Default: "data/db.json" resolved against ContentRootPath
            var root = env?.ContentRootPath ?? Directory.GetCurrentDirectory();
            return Path.GetFullPath(Path.Combine(root, "data", "db.json"));
        }

        public static string ResolveLegacyPath()
        {
            return Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "db.json"));
        }

        public static string ComputeSha256(string filePath)
        {
            using var sha256 = SHA256.Create();
            using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            var hashBytes = sha256.ComputeHash(stream);
            return Convert.ToHexString(hashBytes).ToLowerInvariant();
        }

        public static bool IsValidDatabaseData(DbData? data, out string? reason)
        {
            if (data == null)
            {
                reason = "Database payload deserialized to null.";
                return false;
            }

            if (data.Users == null)
            {
                reason = "Mandatory collection 'Users' is missing.";
                return false;
            }

            if (data.Users.Count == 0)
            {
                reason = "Collection 'Users' is empty. Valid database must contain user records.";
                return false;
            }

            if (data.AIConfigurations == null)
            {
                reason = "Mandatory collection 'AIConfigurations' is missing.";
                return false;
            }

            if (!data.AIConfigurations.ContainsKey("default"))
            {
                reason = "Default AI configuration ('default') is missing in 'AIConfigurations'.";
                return false;
            }

            if (data.Sessions == null)
            {
                reason = "Mandatory collection 'Sessions' is missing.";
                return false;
            }

            if (data.Transactions == null)
            {
                reason = "Mandatory collection 'Transactions' is missing.";
                return false;
            }

            if (data.CVs == null)
            {
                reason = "Mandatory collection 'CVs' is missing.";
                return false;
            }

            reason = null;
            return true;
        }

        public static bool TryValidateTempFile(string tempPath, out DbData? recoveredData, out string? errorMessage)
        {
            recoveredData = null;
            errorMessage = null;

            if (!File.Exists(tempPath))
            {
                errorMessage = "File does not exist.";
                return false;
            }

            try
            {
                var json = File.ReadAllText(tempPath);
                if (string.IsNullOrWhiteSpace(json))
                {
                    errorMessage = "File is empty or contains only whitespace.";
                    return false;
                }

                DbData? data;
                try
                {
                    data = JsonSerializer.Deserialize<DbData>(json);
                }
                catch (JsonException ex)
                {
                    errorMessage = $"Malformed JSON: {ex.Message}";
                    return false;
                }

                if (!IsValidDatabaseData(data, out var validationReason))
                {
                    errorMessage = $"Schema validation failed: {validationReason}";
                    return false;
                }

                recoveredData = data;
                return true;
            }
            catch (Exception ex)
            {
                errorMessage = $"Error reading temp file: {ex.Message}";
                return false;
            }
        }

        public static void PreserveInvalidTempFile(string tempPath, string? reason)
        {
            try
            {
                if (File.Exists(tempPath))
                {
                    var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
                    var preservedPath = $"{tempPath}.invalid.{timestamp}";
                    File.Move(tempPath, preservedPath, overwrite: true);
                    Console.WriteLine($"[FileDb] Preserved invalid temp file at '{preservedPath}' (Reason: {reason})");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[FileDb] Notice: Failed to preserve invalid temp file: {ex.Message}");
            }
        }

        private void InitializeStorage(IWebHostEnvironment? env)
        {
            lock (_lock)
            {
                var legacyPath = ResolveLegacyPath();
                bool isProduction = env != null
                    ? env.IsProduction()
                    : string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Production", StringComparison.OrdinalIgnoreCase);

                var isSamePath = string.Equals(_filePath, legacyPath, StringComparison.OrdinalIgnoreCase);

                // Case 1: Target does not exist, but legacy exists
                if (!File.Exists(_filePath) && !isSamePath && File.Exists(legacyPath))
                {
                    MigrateFromLegacy(legacyPath);
                }
                // Case 2: Target exists, legacy also exists
                else if (File.Exists(_filePath) && !isSamePath && File.Exists(legacyPath))
                {
                    CompareAndLogDiscrepancies(legacyPath);
                }
                // Case 3: Neither target nor legacy exists
                else if (!File.Exists(_filePath))
                {
                    var tempPath = _filePath + ".tmp";
                    if (File.Exists(tempPath))
                    {
                        Console.WriteLine($"[FileDb] Potential recovery file found at '{tempPath}'. Validating schema and integrity...");
                        if (TryValidateTempFile(tempPath, out var recovered, out var validationError))
                        {
                            File.Move(tempPath, _filePath, overwrite: true);
                            Console.WriteLine("[FileDb] Successfully recovered missing database from validated .tmp file!");
                            LoadFromPath();
                            return;
                        }
                        else
                        {
                            Console.WriteLine($"[FileDb] WARNING: .tmp file at '{tempPath}' is INVALID ({validationError}). Preserving file without recovering.");
                            PreserveInvalidTempFile(tempPath, validationError);
                        }
                    }

                    if (isProduction)
                    {
                        throw new FileNotFoundException(
                            $"[FileDb] FATAL: Persistent database not found at '{_filePath}'. " +
                            "Auto-seeding is strictly disabled in Production environment to prevent silent data loss. " +
                            "Please provide an existing database or run manual bootstrap.");
                    }

                    Console.WriteLine($"[FileDb] No database found at '{_filePath}'. Initializing fresh database with default seed data for Development/Demo environment.");
                    SeedData();
                    Save();
                    return;
                }

                // Authoritative load
                LoadFromPath();
            }
        }

        private void MigrateFromLegacy(string legacyPath)
        {
            Console.WriteLine($"[FileDb] Target database '{_filePath}' does not exist. Legacy database found at '{legacyPath}'. Initiating safe migration...");

            // Step 1: Validate legacy file can be read and deserialized
            DbData? legacyData = null;
            try
            {
                var legacyJson = File.ReadAllText(legacyPath);
                legacyData = JsonSerializer.Deserialize<DbData>(legacyJson);
                if (!IsValidDatabaseData(legacyData, out var validationReason))
                {
                    throw new InvalidDataException($"Legacy database failed schema validation: {validationReason}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[FileDb] CRITICAL: Legacy database at '{legacyPath}' is corrupt or unreadable: {ex.Message}");
                throw new InvalidOperationException($"Cannot migrate from corrupt legacy database at '{legacyPath}'. Aborting startup to protect data integrity.", ex);
            }

            // Step 2: Ensure target directory exists
            var targetDir = Path.GetDirectoryName(_filePath);
            if (!string.IsNullOrEmpty(targetDir) && !Directory.Exists(targetDir))
            {
                Directory.CreateDirectory(targetDir);
            }

            // Step 3: Copy to temporary file on the same filesystem / target directory
            var tempMigrationPath = _filePath + $".migration.{Guid.NewGuid():N}.tmp";
            try
            {
                using (var sourceStream = new FileStream(legacyPath, FileMode.Open, FileAccess.Read, FileShare.Read))
                using (var destStream = new FileStream(tempMigrationPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                {
                    sourceStream.CopyTo(destStream);
                    destStream.Flush(flushToDisk: true);
                }

                // Step 4: Verify integrity of copied temp file
                var tempJson = File.ReadAllText(tempMigrationPath);
                var verifiedData = JsonSerializer.Deserialize<DbData>(tempJson);
                if (!IsValidDatabaseData(verifiedData, out var tempValidationReason))
                {
                    throw new InvalidOperationException($"Verification failed: migrated temporary file failed schema validation: {tempValidationReason}");
                }

                var sourceHash = ComputeSha256(legacyPath);
                var tempHash = ComputeSha256(tempMigrationPath);
                if (!string.Equals(sourceHash, tempHash, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException($"Verification failed: SHA-256 mismatch between legacy source ({sourceHash}) and temp migration file ({tempHash}).");
                }

                // Step 5: Atomically move verified temp file to target
                File.Move(tempMigrationPath, _filePath, overwrite: true);

                Console.WriteLine($"[FileDb] Safe migration SUCCESSFUL: {legacyPath} -> {_filePath} (SHA-256: {sourceHash}). Legacy file preserved untouched.");
            }
            catch (Exception ex)
            {
                if (File.Exists(tempMigrationPath))
                {
                    try { File.Delete(tempMigrationPath); } catch { /* Ignore */ }
                }
                Console.WriteLine($"[FileDb] Migration failed: {ex.Message}. Legacy file '{legacyPath}' remains untouched.");
                throw;
            }
        }

        private void CompareAndLogDiscrepancies(string legacyPath)
        {
            try
            {
                var targetHash = ComputeSha256(_filePath);
                var legacyHash = ComputeSha256(legacyPath);

                if (string.Equals(targetHash, legacyHash, StringComparison.OrdinalIgnoreCase))
                {
                    Console.WriteLine($"[FileDb] SSOT database '{_filePath}' and legacy database '{legacyPath}' are identical (SHA-256: {targetHash}). Using SSOT.");
                }
                else
                {
                    Console.WriteLine($"[FileDb] WARNING: Legacy database exists at '{legacyPath}' and differs from SSOT at '{_filePath}'.");
                    Console.WriteLine($"[FileDb] SSOT Hash: {targetHash} | Legacy Hash: {legacyHash}. Using SSOT database. Reconciliation may be required.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[FileDb] Notice: Could not compare SSOT with legacy database: {ex.Message}");
            }
        }

        public void Load()
        {
            lock (_lock)
            {
                InitializeStorage(null);
            }
        }

        private void LoadFromPath()
        {
            var tempPath = _filePath + ".tmp";

            try
            {
                var json = File.ReadAllText(_filePath);
                var data = JsonSerializer.Deserialize<DbData>(json);
                if (!IsValidDatabaseData(data, out var validationReason))
                {
                    throw new InvalidDataException($"Database file at '{_filePath}' failed schema validation: {validationReason}");
                }

                PopulateFromData(data!);

                // Archive any stale .tmp file left behind by interrupted saves
                if (File.Exists(tempPath))
                {
                    try
                    {
                        var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
                        var archivedPath = $"{tempPath}.leftover.{timestamp}";
                        File.Move(tempPath, archivedPath, overwrite: true);
                        Console.WriteLine($"[FileDb] Archived leftover temp file to '{archivedPath}'");
                    }
                    catch { /* Ignore */ }
                }

                // Re-seed if admin missing (e.g. fresh install)
                if (!Users.ContainsKey("user_admin"))
                {
                    SeedData();
                    Save();
                }

                if (!AIConfigurations.ContainsKey("default"))
                {
                    AIConfigurations["default"] = new AIConfiguration
                    {
                        Id = "default",
                        Provider = "Vilao AI",
                        BaseUrl = "https://api.vilao.ai/v1/",
                        Model = "ag/gemini-3.8-flash",
                        Enabled = true,
                        Temperature = 0.7,
                        MaxTokens = 1000
                    };

                    Save();
                }

                // Automatic migration of legacy plaintext passwords to secure PBKDF2 hashes
                bool needsMigration = false;
                foreach (var kvp in Users)
                {
                    var user = kvp.Value;
                    if (string.IsNullOrEmpty(user.PasswordHash) && !string.IsNullOrEmpty(user.Password))
                    {
                        user.PasswordHash = PasswordHasher.HashPassword(user.Password);
                        user.Password = string.Empty;
                        needsMigration = true;
                    }
                    else if (!string.IsNullOrEmpty(user.PasswordHash) && !string.IsNullOrEmpty(user.Password))
                    {
                        user.Password = string.Empty;
                        needsMigration = true;
                    }
                }

                if (needsMigration)
                {
                    Save();
                }
            }
            catch (Exception ex)
            {
                HandleCorruptDatabase(ex);
            }
        }

        private void PopulateFromData(DbData data)
        {
            Users = new ConcurrentDictionary<string, User>(data.Users ?? new());
            Sessions = new ConcurrentDictionary<string, Session>(data.Sessions ?? new());
            Transactions = new ConcurrentBag<PaymentTransaction>(data.Transactions ?? new());
            AIConfigurations = new ConcurrentDictionary<string, AIConfiguration>(data.AIConfigurations ?? new());
            CVs = new ConcurrentDictionary<string, CandidateCV>(data.CVs ?? new());
            ProviderConnections = new ConcurrentDictionary<string, ProviderConnection>(data.ProviderConnections ?? new());
            ModelRegistrations = new ConcurrentDictionary<string, ModelRegistration>(data.ModelRegistrations ?? new());
            ConfigurationVersions = new ConcurrentDictionary<string, ConfigurationVersion>(data.ConfigurationVersions ?? new());
        }

        private void HandleCorruptDatabase(Exception ex)
        {
            Console.WriteLine($"[FileDb] Error loading database: {ex.Message}");
            var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
            var corruptBackupPath = $"{_filePath}.corrupt.{timestamp}";
            try
            {
                if (File.Exists(_filePath))
                {
                    File.Copy(_filePath, corruptBackupPath, overwrite: true);
                    Console.WriteLine($"[FileDb] CORRUPTED DATABASE DETECTED! Created backup at {corruptBackupPath}");
                }

                var tempPath = _filePath + ".tmp";
                if (File.Exists(tempPath))
                {
                    Console.WriteLine($"[FileDb] Corrupt database detected. Attempting recovery from '{tempPath}'...");
                    if (TryValidateTempFile(tempPath, out var data, out var validationError))
                    {
                        Console.WriteLine("[FileDb] Successfully recovered database from validated .tmp file!");
                        File.Move(tempPath, _filePath, overwrite: true);
                        PopulateFromData(data!);
                        return;
                    }
                    else
                    {
                        Console.WriteLine($"[FileDb] WARNING: .tmp file at '{tempPath}' is INVALID ({validationError}). Preserving file without recovering.");
                        PreserveInvalidTempFile(tempPath, validationError);
                    }
                }
            }
            catch (Exception recEx)
            {
                Console.WriteLine($"[FileDb] Recovery failed: {recEx.Message}");
            }

            throw new InvalidOperationException($"[FileDb] FATAL: Database at '{_filePath}' is corrupt and could not be safely recovered. Startup aborted to protect data integrity.", ex);
        }



        private void SeedData()
        {
            var now = DateTime.UtcNow;

            // ─── ADMIN ───────────────────────────────────────────────────────
            Users["user_admin"] = new User
            {
                Id = "user_admin",
                Fullname = "System Administrator",
                Email = "admin@prepmate.vn",
                Username = "admin",
                PasswordHash = PasswordHasher.HashPassword("Admin@123"),
                Password = string.Empty,
                Role = "admin",
                Subscription = "pro",
                SubscriptionDate = now.ToString("o"),
                SubscriptionExpiry = now.AddYears(100).ToString("o"),
                CreatedAt = now
            };

            // ─── MANAGERS ────────────────────────────────────────────────────
            Users["user_mgr1"] = new User
            {
                Id = "user_mgr1",
                Fullname = "Nguyễn Thị Lan",
                Email = "lan.nguyen@prepmate.vn",
                Username = "manager_lan",
                PasswordHash = PasswordHasher.HashPassword("Manager@123"),
                Password = string.Empty,
                Role = "manager",
                Subscription = "pro",
                SubscriptionDate = now.ToString("o"),
                SubscriptionExpiry = now.AddYears(5).ToString("o"),
                CreatedAt = now.AddDays(-120)
            };

            Users["user_mgr2"] = new User
            {
                Id = "user_mgr2",
                Fullname = "Trần Văn Minh",
                Email = "minh.tran@prepmate.vn",
                Username = "manager_minh",
                PasswordHash = PasswordHasher.HashPassword("Manager@123"),
                Password = string.Empty,
                Role = "manager",
                Subscription = "pro",
                SubscriptionDate = now.ToString("o"),
                SubscriptionExpiry = now.AddYears(5).ToString("o"),
                CreatedAt = now.AddDays(-90)
            };

            Users["user_mgr3"] = new User
            {
                Id = "user_mgr3",
                Fullname = "Phạm Thu Hà",
                Email = "ha.pham@prepmate.vn",
                Username = "manager_ha",
                PasswordHash = PasswordHasher.HashPassword("Manager@123"),
                Password = string.Empty,
                Role = "manager",
                Subscription = "pro",
                SubscriptionDate = now.ToString("o"),
                SubscriptionExpiry = now.AddYears(5).ToString("o"),
                CreatedAt = now.AddDays(-60)
            };

            // ─── REGULAR USERS ───────────────────────────────────────────────
            Users["user_001"] = new User
            {
                Id = "user_001",
                Fullname = "Lê Hoàng Nam",
                Email = "nam.le@gmail.com",
                Username = "hoangnam99",
                PasswordHash = PasswordHasher.HashPassword("user123"),
                Password = string.Empty,
                Role = "user",
                Subscription = "pro",
                SubscriptionDate = now.AddDays(-15).ToString("o"),
                SubscriptionExpiry = now.AddDays(15).ToString("o"),
                CreatedAt = now.AddDays(-30)
            };

            Users["user_002"] = new User
            {
                Id = "user_002",
                Fullname = "Võ Thị Mai",
                Email = "mai.vo@gmail.com",
                Username = "maivo_ux",
                PasswordHash = PasswordHasher.HashPassword("user123"),
                Password = string.Empty,
                Role = "user",
                Subscription = "pro",
                SubscriptionDate = now.AddDays(-5).ToString("o"),
                SubscriptionExpiry = now.AddDays(25).ToString("o"),
                CreatedAt = now.AddDays(-20)
            };

            Users["user_003"] = new User
            {
                Id = "user_003",
                Fullname = "Đinh Quang Huy",
                Email = "huy.dinh@outlook.com",
                Username = "quanghuy_dev",
                PasswordHash = PasswordHasher.HashPassword("user123"),
                Password = string.Empty,
                Role = "user",
                Subscription = "free",
                CreatedAt = now.AddDays(-14)
            };

            Users["user_004"] = new User
            {
                Id = "user_004",
                Fullname = "Bùi Thanh Thảo",
                Email = "thao.bui@yahoo.com",
                Username = "thanhthao2k",
                PasswordHash = PasswordHasher.HashPassword("user123"),
                Password = string.Empty,
                Role = "user",
                Subscription = "free",
                CreatedAt = now.AddDays(-7)
            };

            Users["user_005"] = new User
            {
                Id = "user_005",
                Fullname = "Nguyễn Trọng Khoa",
                Email = "khoa.nguyen@gmail.com",
                Username = "trongkhoa_it",
                PasswordHash = PasswordHasher.HashPassword("user123"),
                Password = string.Empty,
                Role = "user",
                Subscription = "pro",
                SubscriptionDate = now.AddDays(-3).ToString("o"),
                SubscriptionExpiry = now.AddDays(27).ToString("o"),
                CreatedAt = now.AddDays(-10)
            };

            Users["user_006"] = new User
            {
                Id = "user_006",
                Fullname = "Trương Ngọc Ánh",
                Email = "anh.truong@gmail.com",
                Username = "ngocanh_hr",
                PasswordHash = PasswordHasher.HashPassword("user123"),
                Password = string.Empty,
                Role = "user",
                Subscription = "free",
                CreatedAt = now.AddDays(-3)
            };

            // ─── SAMPLE TRANSACTIONS ─────────────────────────────────────────
            Transactions.Add(new PaymentTransaction { Method = "momo", Amount = 199000, Currency = "VND", User = "user_001", MomoPhone = "0901234567", TransactionId = "MOMO20260601001", Timestamp = now.AddDays(-15).ToString("o") });
            Transactions.Add(new PaymentTransaction { Method = "bank", Amount = 199000, Currency = "VND", User = "user_002", BankReference = "PREPMATE_1750000002", Timestamp = now.AddDays(-5).ToString("o") });
            Transactions.Add(new PaymentTransaction { Method = "momo", Amount = 199000, Currency = "VND", User = "user_005", MomoPhone = "0987654321", TransactionId = "MOMO20260626005", Timestamp = now.AddDays(-3).ToString("o") });

            // ─── DEFAULT AI CONFIGURATION ────────────────────────────────────
            if (!AIConfigurations.ContainsKey("default"))
            {
                AIConfigurations["default"] = new AIConfiguration
                {
                    Id = "default",
                    Provider = "Vilao AI",
                    BaseUrl = "https://api.vilao.ai/v1/",
                    Model = "ag/gemini-3.8-flash",
                    Enabled = true,
                    Temperature = 0.7,
                    MaxTokens = 1000
                };
            }
        }

        public void Save()
        {
            lock (_lock)
            {
                try
                {
                    var dir = Path.GetDirectoryName(_filePath);
                    if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                    {
                        Directory.CreateDirectory(dir);
                    }

                    // Ensure zero plaintext passwords exist before persisting
                    foreach (var u in Users.Values)
                    {
                        u.Password = string.Empty;
                    }

                    var data = new DbData
                    {
                        Users = Users,
                        Sessions = Sessions,
                        Transactions = new List<PaymentTransaction>(Transactions),
                        AIConfigurations = AIConfigurations,
                        CVs = CVs,
                        ProviderConnections = ProviderConnections,
                        ModelRegistrations = ModelRegistrations,
                        ConfigurationVersions = ConfigurationVersions
                    };
                    var json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });

                    // Atomic write via temp file + atomic move
                    var tempPath = _filePath + ".tmp";
                    File.WriteAllText(tempPath, json);
                    File.Move(tempPath, _filePath, overwrite: true);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[FileDb] Error saving: {ex.Message}");
                }
            }
        }

        // ─── CONCURRENCY & SERIALIZATION HELPERS ─────────────────────────

        public void WithLock(Action action)
        {
            lock (_lock)
            {
                action();
            }
        }

        public T WithLock<T>(Func<T> func)
        {
            lock (_lock)
            {
                return func();
            }
        }

        public void Mutate(Action<FileDb> action)
        {
            lock (_lock)
            {
                action(this);
                Save();
            }
        }

        public bool UpdateUser(string userId, Action<User> mutate)
        {
            lock (_lock)
            {
                if (Users.TryGetValue(userId, out var user))
                {
                    mutate(user);
                    Save();
                    return true;
                }
                return false;
            }
        }

        public bool UpdateCV(string cvId, Action<CandidateCV> mutate)
        {
            lock (_lock)
            {
                if (CVs.TryGetValue(cvId, out var cv))
                {
                    mutate(cv);
                    Save();
                    return true;
                }
                return false;
            }
        }

        public bool UpdateSession(string sessionId, Action<Session> mutate)
        {
            lock (_lock)
            {
                if (Sessions.TryGetValue(sessionId, out var session))
                {
                    mutate(session);
                    Save();
                    return true;
                }
                return false;
            }
        }

        public class DbData
        {
            public ConcurrentDictionary<string, User>? Users { get; set; }

            public ConcurrentDictionary<string, Session>? Sessions { get; set; }

            public List<PaymentTransaction>? Transactions { get; set; }

            public ConcurrentDictionary<string, AIConfiguration>? AIConfigurations { get; set; }

            public ConcurrentDictionary<string, CandidateCV>? CVs { get; set; }

            public ConcurrentDictionary<string, ProviderConnection>? ProviderConnections { get; set; }

            public ConcurrentDictionary<string, ModelRegistration>? ModelRegistrations { get; set; }

            public ConcurrentDictionary<string, ConfigurationVersion>? ConfigurationVersions { get; set; }
        }
    }
}

