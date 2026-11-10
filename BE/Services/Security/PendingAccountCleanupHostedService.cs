using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using backend.Services.Storage;

namespace backend.Services.Security
{
    public interface IPendingAccountCleanupService
    {
        int CleanupExpiredPendingAccounts();
    }

    public class PendingAccountCleanupHostedService : IHostedService, IDisposable, IPendingAccountCleanupService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly AuthLifecycleOptions _options;
        private readonly ILogger<PendingAccountCleanupHostedService> _logger;
        private Timer? _timer;

        public PendingAccountCleanupHostedService(
            IServiceProvider serviceProvider,
            AuthLifecycleOptions options,
            ILogger<PendingAccountCleanupHostedService> logger)
        {
            _serviceProvider = serviceProvider;
            _options = options;
            _logger = logger;
        }

        public Task StartAsync(CancellationToken cancellationToken)
        {
            var interval = TimeSpan.FromMinutes(Math.Max(1, _options.PendingCleanupIntervalMinutes));
            // Run initial sweep after 5 seconds, then every configured interval
            _timer = new Timer(ExecuteCleanup, null, TimeSpan.FromSeconds(5), interval);
            _logger.LogInformation("[PendingAccountCleanup] Service started. Sweep interval: {Interval} minutes.", _options.PendingCleanupIntervalMinutes);
            return Task.CompletedTask;
        }

        private void ExecuteCleanup(object? state)
        {
            try
            {
                CleanupExpiredPendingAccounts();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[PendingAccountCleanup] Error occurred during scheduled cleanup sweep.");
            }
        }

        public int CleanupExpiredPendingAccounts()
        {
            using var scope = _serviceProvider.CreateScope();
            var fileDb = scope.ServiceProvider.GetRequiredService<FileDb>();
            return PerformCleanup(fileDb, _logger);
        }

        public static int PerformCleanup(FileDb fileDb, ILogger? logger = null)
        {
            if (fileDb == null) return 0;

            lock (fileDb)
            {
                var now = DateTime.UtcNow;

                // Find candidate accounts: unverified and expired
                var candidates = fileDb.Users.Values
                    .Where(u => !u.EmailVerified && u.IsPendingRegistrationExpired)
                    .ToList();

                if (candidates.Count == 0)
                {
                    return 0;
                }

                var removedCount = 0;

                foreach (var user in candidates)
                {
                    // Strict Safety Gates: Never delete administrative or manager accounts
                    if (string.Equals(user.Role, "admin", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(user.Role, "manager", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    // Strict Safety Gates: Never delete if account has associated interview sessions
                    var hasSessions = fileDb.Sessions != null &&
                        fileDb.Sessions.Values.Any(s => string.Equals(s.UserId, user.Id, StringComparison.OrdinalIgnoreCase));
                    if (hasSessions)
                    {
                        continue;
                    }

                    // Strict Safety Gates: Never delete if account has associated CVs
                    var hasCvs = fileDb.CVs != null &&
                        fileDb.CVs.Values.Any(cv => string.Equals(cv.UserId, user.Id, StringComparison.OrdinalIgnoreCase));
                    if (hasCvs)
                    {
                        continue;
                    }

                    // Strict Safety Gates: Never delete if account has associated transactions
                    var hasTransactions = fileDb.Transactions != null &&
                        fileDb.Transactions.Any(t => string.Equals(t.User, user.Id, StringComparison.OrdinalIgnoreCase));
                    if (hasTransactions)
                    {
                        continue;
                    }

                    // Safe to remove expired pending registration reservation
                    if (fileDb.Users.Remove(user.Id, out _))
                    {
                        removedCount++;
                    }
                }

                if (removedCount > 0)
                {
                    fileDb.Save();
                    logger?.LogInformation("[PendingAccountCleanup] Swept and removed {Count} expired unverified pending accounts.", removedCount);
                    Console.WriteLine($"[PendingAccountCleanup] Swept and removed {removedCount} expired unverified pending account(s).");
                }

                return removedCount;
            }
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            _timer?.Change(Timeout.Infinite, 0);
            return Task.CompletedTask;
        }

        public void Dispose()
        {
            _timer?.Dispose();
        }
    }
}
