using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;

namespace backend.Middleware
{
    public class RateLimitMiddleware
    {
        private readonly RequestDelegate _next;
        private static readonly ConcurrentDictionary<string, (int RequestCount, DateTime WindowStart)> _clientStore 
            = new ConcurrentDictionary<string, (int, DateTime)>();
        
        private const int LimitFreePerMinute = 60;
        private static readonly TimeSpan WindowSize = TimeSpan.FromMinutes(1);

        public RateLimitMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var clientIp = context.Connection.RemoteIpAddress?.ToString() ?? "unknown-ip";
            var isPrivileged = context.User.IsInRole("admin") 
                || context.User.IsInRole("manager") 
                || context.User.HasClaim(c => c.Type == "subscription" && c.Value == "pro");
            
            if (isPrivileged)
            {
                await _next(context);
                return;
            }

            var now = DateTime.UtcNow;
            var clientKey = $"{clientIp}_{now.Minute}";

            var clientData = _clientStore.GetOrAdd(clientKey, k => (0, now));

            if (now - clientData.WindowStart > WindowSize)
            {
                _clientStore.TryUpdate(clientKey, (1, now), clientData);
            }
            else
            {
                if (clientData.RequestCount >= LimitFreePerMinute)
                {
                    context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsJsonAsync(new
                    {
                        error = "Quá nhiều yêu cầu",
                        message = "Tài khoản Free bị giới hạn 60 yêu cầu/phút. Hãy nâng cấp gói PRO để loại bỏ giới hạn này!"
                    });
                    return;
                }
                
                _clientStore.TryUpdate(clientKey, (clientData.RequestCount + 1, clientData.WindowStart), clientData);
            }

            await _next(context);
        }
    }
}
