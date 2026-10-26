using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;

namespace backend.Services.Storage
{
    public interface ISessionLockManager
    {
        Task<IDisposable> AcquireLockAsync(string sessionId, CancellationToken cancellationToken = default);
    }

    public class SessionLockManager : ISessionLockManager
    {
        private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

        public async Task<IDisposable> AcquireLockAsync(string sessionId, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(sessionId))
            {
                return new EmptyDisposable();
            }

            var semaphore = _locks.GetOrAdd(sessionId, _ => new SemaphoreSlim(1, 1));
            await semaphore.WaitAsync(cancellationToken);
            return new Releaser(semaphore);
        }

        private sealed class Releaser : IDisposable
        {
            private readonly SemaphoreSlim _semaphore;
            private bool _disposed;

            public Releaser(SemaphoreSlim semaphore)
            {
                _semaphore = semaphore;
            }

            public void Dispose()
            {
                if (!_disposed)
                {
                    _semaphore.Release();
                    _disposed = true;
                }
            }
        }

        public sealed class EmptyDisposable : IDisposable
        {
            public void Dispose() { }
        }
    }
}
