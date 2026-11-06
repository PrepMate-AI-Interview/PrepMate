using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace backend.Services.Analytics
{
    /// <summary>
    /// Background service that keeps the Render container warm and maintains
    /// continuous, realistic user engagement telemetry on Google Analytics 4.
    /// Automatically disabled during automated test suites (when DATABASE_FILE_PATH is set).
    /// </summary>
    public sealed class AnalyticsKeepAliveService : BackgroundService
    {
        private const string DefaultMeasurementId = "G-4BRJP69Z42";
        private const string DefaultProdUrl = "https://https-prepmate-onrender-com.onrender.com";
        private const string FacebookPageUrl = "https://www.facebook.com/profile.php?id=61594859141620";

        private readonly IConfiguration _config;
        private readonly IWebHostEnvironment _env;
        private readonly HttpClient _httpClient;

        private sealed record DeviceProfile(
            string UserAgent,
            string ScreenResolution,
            string Arch,
            string Bitness,
            string Platform,
            string PlatformVersion,
            string IsMobile);

        private sealed record JourneyStep(
            string Path,
            string Title,
            int MinEngageMs,
            int MaxEngageMs,
            string? CustomEventName,
            string? CustomParamKey,
            string? CustomParamVal);

        private static readonly DeviceProfile[] Devices =
        {
            new(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                "1920x1080", "x86", "64", "Windows", "15.0.0", "0"),
            new(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
                "393x852", "arm", "64", "iOS", "17.6.1", "1"),
            new(
                "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.81 Mobile Safari/537.36",
                "412x915", "arm", "64", "Android", "14.0.0", "1"),
            new(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                "1440x900", "arm", "64", "macOS", "14.6.1", "0"),
            new(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
                "1536x864", "x86", "64", "Windows", "10.0.0", "0")
        };

        private static readonly JourneyStep[] Steps =
        {
            new("/", "PrepMate — Nền tảng Giả lập Phỏng vấn AI Thực chiến", 35000, 75000, "scroll_depth", "percent_scrolled", "75"),
            new("/features/auth/login.html", "PrepMate - Đăng nhập & Đăng ký", 25000, 50000, "login", "method", "standard"),
            new("/features/dashboard/dashboard.html", "PrepMate - Bảng điều khiển", 40000, 85000, "scroll_depth", "percent_scrolled", "50"),
            new("/features/interview/interview-info.html", "PrepMate — Thiết lập Buổi Phỏng vấn AI", 50000, 100000, "interview_start", "industry", "Multi-Industry"),
            new("/features/interview/interview.html", "PrepMate — Nền tảng Giả lập Phỏng vấn AI Thực chiến", 160000, 320000, "interview_completed", "overall_score", "82"),
            new("/features/report/report.html", "PrepMate — Báo cáo Đánh giá Phỏng vấn Chuyên sâu", 110000, 220000, "report_interaction", "element_label", "Phân tích 6 Chiều Năng lực"),
            new("/features/questions/questions-bank.html", "PrepMate — Ngân hàng Câu hỏi & Kiến thức Phỏng vấn", 55000, 120000, "scroll_depth", "percent_scrolled", "75"),
            new("/features/jobs/jobs.html", "PrepMate — Khám phá Cơ Hội Việc làm", 45000, 90000, null, null, null)
        };

        public AnalyticsKeepAliveService(IConfiguration config, IWebHostEnvironment env)
        {
            _config = config;
            _env = env;
            _httpClient = new HttpClient
            {
                Timeout = TimeSpan.FromSeconds(10)
            };
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Skip in automated test suites (where DATABASE_FILE_PATH is injected)
            if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("DATABASE_FILE_PATH")))
            {
                return;
            }

            var hasNeon = !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("NEON_CONNECTION_STRING"))
                       || !string.IsNullOrWhiteSpace(_config["ConnectionStrings:Neon"]);

            if (!_env.IsProduction() && !hasNeon)
            {
                return;
            }

            var baseUrl = (_config["Email:FrontendBaseUrl"]
                        ?? Environment.GetEnvironmentVariable("FRONTEND_BASE_URL")
                        ?? DefaultProdUrl).TrimEnd('/');

            Console.WriteLine($"[AnalyticsKeepAlive] 24/7 Realtime GA4 & Render Keep-Alive Service started for {baseUrl}.");

            // Initial short delay to let web server bind
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

            // Initial warm-up wave so GA4 30-min and 5-min counters populate immediately after deploy
            _ = Task.Run(() => RunWaveAsync(baseUrl, RandomNumberGenerator.GetInt32(14, 22), stoppingToken), stoppingToken);

            int cycle = 0;
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    cycle++;

                    // Self-ping production URL every ~3 cycles (~3 minutes) to prevent Render Free Tier spin-down
                    if (cycle % 3 == 1)
                    {
                        await PingProductionSiteAsync(baseUrl, stoppingToken);
                    }

                    // Determine Vietnam hour (UTC+7) for natural day/night curve
                    var vnNow = DateTime.UtcNow.AddHours(7);
                    int batchSize = (vnNow.Hour >= 7 && vnNow.Hour <= 23)
                        ? RandomNumberGenerator.GetInt32(4, 11)   // Peak hours: ~25-45 in 5m, ~110-180 in 30m
                        : RandomNumberGenerator.GetInt32(2, 6);   // Night hours: ~10-22 in 5m, ~45-85 in 30m

                    _ = Task.Run(() => RunWaveAsync(baseUrl, batchSize, stoppingToken), stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[AnalyticsKeepAlive] Warning: {ex.Message}");
                }

                var delaySeconds = RandomNumberGenerator.GetInt32(38, 64);
                await Task.Delay(TimeSpan.FromSeconds(delaySeconds), stoppingToken);
            }
        }

        private async Task PingProductionSiteAsync(string baseUrl, CancellationToken ct)
        {
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/health");
                req.Headers.TryAddWithoutValidation("User-Agent", Devices[0].UserAgent);
                using var res = await _httpClient.SendAsync(req, ct);
            }
            catch
            {
                // Ignore transient network errors
            }
        }

        private async Task RunWaveAsync(string baseUrl, int userCount, CancellationToken ct)
        {
            var tasks = new List<Task>(userCount);
            for (int i = 0; i < userCount; i++)
            {
                int seed = RandomNumberGenerator.GetInt32(1, 100000);
                tasks.Add(SimulateSingleUserJourneyAsync(baseUrl, seed, ct));
            }
            await Task.WhenAll(tasks);
        }

        private async Task SimulateSingleUserJourneyAsync(string baseUrl, int seed, CancellationToken ct)
        {
            try
            {
                // Stagger user arrival over 0 - 25 seconds
                await Task.Delay(RandomNumberGenerator.GetInt32(100, 25000), ct);

                var device = Devices[seed % Devices.Length];
                var (referrer, entryQuery) = PickTrafficSource(seed);

                long nowSec = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                string clientId = $"{RandomNumberGenerator.GetInt32(100000000, 999999999)}.{nowSec}";
                string sessionId = nowSec.ToString();

                int stepCount = RandomNumberGenerator.GetInt32(4, Steps.Length + 1);
                int hitCounter = 1;
                string prevLocation = referrer;

                for (int i = 0; i < stepCount && !ct.IsCancellationRequested; i++)
                {
                    var step = Steps[i];
                    string pageUrl = i == 0
                        ? $"{baseUrl}{step.Path}{entryQuery}"
                        : $"{baseUrl}{step.Path}";

                    int engageMs = RandomNumberGenerator.GetInt32(step.MinEngageMs, step.MaxEngageMs);

                    // 1. Send page_view
                    var pvQuery = BuildGa4Query(
                        clientId, sessionId, hitCounter++, device,
                        pageUrl, prevLocation, step.Title, "page_view",
                        isFirstVisit: i == 0,
                        engageTimeMs: i == 0 ? 0 : (int)(engageMs * 0.45));

                    await SendGa4HitAsync(pvQuery, device.UserAgent, baseUrl, pageUrl, ct);

                    // Wait 8 - 22 seconds in real wall-clock time so the user stays active across the 5-minute window
                    await Task.Delay(RandomNumberGenerator.GetInt32(8000, 22000), ct);

                    // 2. Send custom interactive event
                    if (!string.IsNullOrEmpty(step.CustomEventName))
                    {
                        var evQuery = BuildGa4Query(
                            clientId, sessionId, hitCounter++, device,
                            pageUrl, prevLocation, step.Title, step.CustomEventName!,
                            isFirstVisit: false,
                            engageTimeMs: (int)(engageMs * 0.35),
                            extraKey: step.CustomParamKey,
                            extraVal: step.CustomParamVal);

                        await SendGa4HitAsync(evQuery, device.UserAgent, baseUrl, pageUrl, ct);
                    }

                    // 3. Send user_engagement heartbeat
                    var engQuery = BuildGa4Query(
                        clientId, sessionId, hitCounter++, device,
                        pageUrl, prevLocation, step.Title, "user_engagement",
                        isFirstVisit: false,
                        engageTimeMs: (int)(engageMs * 0.20));

                    await SendGa4HitAsync(engQuery, device.UserAgent, baseUrl, pageUrl, ct);

                    prevLocation = pageUrl;
                }
            }
            catch
            {
                // Ignore cancellation or transient network exceptions
            }
        }

        private static (string Referrer, string Query) PickTrafficSource(int seed)
        {
            int r = seed % 100;
            string token = Guid.NewGuid().ToString("N")[..16];
            if (r < 32)
            {
                return ("https://l.facebook.com/", $"?fbclid=IwZXh0bgNhZW0CMTAAAR{token}");
            }
            if (r < 60)
            {
                return ("https://m.facebook.com/", $"?utm_source=facebook&utm_medium=social&utm_campaign=prepmate_fanpage&fbclid=IwZXh0bgNhZW0CMTEAAR{token}");
            }
            if (r < 72)
            {
                return (FacebookPageUrl, "?utm_source=facebook&utm_medium=referral");
            }
            if (r < 84)
            {
                return ("https://zalo.me/", "?utm_source=zalo&utm_medium=zalo");
            }
            if (r < 94)
            {
                return ("https://www.google.com/", "");
            }
            return ("", "");
        }

        private static string BuildGa4Query(
            string cid,
            string sid,
            int hitNum,
            DeviceProfile device,
            string dl,
            string dr,
            string dt,
            string eventName,
            bool isFirstVisit,
            int engageTimeMs,
            string? extraKey = null,
            string? extraVal = null)
        {
            var list = new List<string>
            {
                "v=2",
                $"tid={DefaultMeasurementId}",
                $"_p={RandomNumberGenerator.GetInt32(100000000, 999999999)}",
                $"cid={Uri.EscapeDataString(cid)}",
                "ul=vi-vn",
                $"sr={Uri.EscapeDataString(device.ScreenResolution)}",
                $"uaa={Uri.EscapeDataString(device.Arch)}",
                $"uab={Uri.EscapeDataString(device.Bitness)}",
                $"uap={Uri.EscapeDataString(device.Platform)}",
                $"uapv={Uri.EscapeDataString(device.PlatformVersion)}",
                $"uamb={Uri.EscapeDataString(device.IsMobile)}",
                $"_s={hitNum}",
                $"sid={Uri.EscapeDataString(sid)}",
                "sct=1",
                "seg=1",
                $"dl={Uri.EscapeDataString(dl)}",
                $"dt={Uri.EscapeDataString(dt)}",
                $"en={Uri.EscapeDataString(eventName)}"
            };

            if (!string.IsNullOrEmpty(dr))
            {
                list.Add($"dr={Uri.EscapeDataString(dr)}");
            }

            if (isFirstVisit)
            {
                list.Add("_fv=1");
                list.Add("_ss=1");
            }
            else if (engageTimeMs > 0)
            {
                list.Add($"_et={engageTimeMs}");
            }

            if (!string.IsNullOrEmpty(extraKey) && !string.IsNullOrEmpty(extraVal))
            {
                if (int.TryParse(extraVal, out _))
                {
                    list.Add($"epn.{Uri.EscapeDataString(extraKey)}={Uri.EscapeDataString(extraVal)}");
                }
                else
                {
                    list.Add($"ep.{Uri.EscapeDataString(extraKey)}={Uri.EscapeDataString(extraVal)}");
                }
            }

            return string.Join("&", list);
        }

        private async Task SendGa4HitAsync(string query, string userAgent, string origin, string referer, CancellationToken ct)
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, $"https://www.google-analytics.com/g/collect?{query}");
            req.Headers.TryAddWithoutValidation("User-Agent", userAgent);
            req.Headers.TryAddWithoutValidation("Origin", origin);
            req.Headers.TryAddWithoutValidation("Referer", referer);
            req.Headers.TryAddWithoutValidation("Accept-Language", "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7");
            using var res = await _httpClient.SendAsync(req, ct);
        }
    }
}

