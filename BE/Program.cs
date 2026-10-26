using System;
using System.IO;
using backend.Services;
using backend.Middleware;
using Microsoft.AspNetCore.ResponseCompression;
using backend.Services.Interview;
using backend.Services.AI;
using backend.Services.Knowledge;
using backend.Services.Company;
using backend.Services.Evaluation;
using backend.Services.Preparation;
using backend.Services.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Security.Claims;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

// Robust resolution of WebRootPath (FE static assets) across root execution, BE subdirectory, published output, and containers
string? resolvedWebRoot = null;
var envWebRoot = Environment.GetEnvironmentVariable("WEB_ROOT_PATH");
if (!string.IsNullOrWhiteSpace(envWebRoot) && Directory.Exists(envWebRoot))
{
    resolvedWebRoot = Path.GetFullPath(envWebRoot);
}
else
{
    var candidatePaths = new[]
    {
        Path.Combine(Directory.GetCurrentDirectory(), "FE"),
        Path.Combine(Directory.GetCurrentDirectory(), "..", "FE"),
        Path.Combine(AppContext.BaseDirectory, "FE"),
        Path.Combine(AppContext.BaseDirectory, "wwwroot")
    };
    foreach (var candidate in candidatePaths)
    {
        if (Directory.Exists(candidate))
        {
            resolvedWebRoot = Path.GetFullPath(candidate);
            break;
        }
    }
}

var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args, WebRootPath = resolvedWebRoot });

var envUrls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS") ?? Environment.GetEnvironmentVariable("DOTNET_URLS");
var envPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(envUrls))
{
    builder.WebHost.UseUrls(envUrls);
}
else if (!string.IsNullOrWhiteSpace(envPort))
{
    builder.WebHost.UseUrls($"http://*:{envPort}");
}
else
{
    builder.WebHost.UseUrls("http://*:5000");
}

// Configure Forwarded Headers for reverse proxy deployment (Nginx, Caddy, Cloudflare, Traefik)
builder.Services.Configure<Microsoft.AspNetCore.Builder.ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor
                             | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto
                             | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedHost;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// Register CORS (Environment-Aware)
var allowedCorsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });

    options.AddPolicy("ProductionCorsPolicy", policy =>
    {
        if (allowedCorsOrigins.Length > 0)
        {
            policy.WithOrigins(allowedCorsOrigins)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials();
        }
        else
        {
            policy.SetIsOriginAllowed(_ => true)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials();
        }
    });
});

// Response Compression
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});

// Add services
builder.Services.AddControllers();

// Configure ASP.NET Core Rate Limiting (Defense-in-depth against resource abuse & brute-force)
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.ContentType = "application/json; charset=utf-8";
        await context.HttpContext.Response.WriteAsync(
            "{\"error\":\"Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau giây lát (429 Too Many Requests).\"}",
            token);
    };

    // 1. Auth policy: login & register endpoints (prevents credential stuffing / brute-force)
    options.AddPolicy("auth-policy", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown_ip";
        return RateLimitPartition.GetFixedWindowLimiter(ip, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 50,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        });
    });

    // 2. AI & resource-intensive operations policy:
    // Gated by caller identity if authenticated, else IP.
    options.AddPolicy("ai-policy", httpContext =>
    {
        var partitionKey = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "anonymous_ai";

        return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 40,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        });
    });


});
builder.Services.AddSingleton<FileDb>(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    var env = sp.GetRequiredService<IWebHostEnvironment>();
    return new FileDb(config, env);
});
builder.Services.AddSingleton<backend.Services.Storage.ISessionLockManager, backend.Services.Storage.SessionLockManager>();
builder.Services.AddSingleton<backend.Services.Storage.SessionLockManager>();
// Configure ASP.NET Core Data Protection with persistent key ring outside repository
var dataProtectionBuilder = builder.Services.AddDataProtection()
    .SetApplicationName("PrepMate");

var keyRingDir = Environment.GetEnvironmentVariable("PREPMATE_KEYRING_PATH")
    ?? builder.Configuration["DataProtection:KeyDirectory"];

if (!string.IsNullOrWhiteSpace(keyRingDir))
{
    var dirInfo = new DirectoryInfo(keyRingDir);
    if (!dirInfo.Exists)
    {
        dirInfo.Create();
    }
    dataProtectionBuilder.PersistKeysToFileSystem(dirInfo);
}
else
{
    string defaultKeyPath;
    if (OperatingSystem.IsWindows())
    {
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        defaultKeyPath = Path.Combine(localAppData, "PrepMate", "keys");
    }
    else
    {
        var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        defaultKeyPath = Path.Combine(home, ".prepmate", "keys");
    }
    var dirInfo = new DirectoryInfo(defaultKeyPath);
    if (!dirInfo.Exists)
    {
        dirInfo.Create();
    }
    dataProtectionBuilder.PersistKeysToFileSystem(dirInfo);
}

builder.Services.AddSingleton<ICredentialProtectionService, DataProtectionCredentialService>();
builder.Services.AddSingleton<IConfigurationVersionService, ConfigurationVersionService>();
builder.Services.AddSingleton<IProviderRegistry, ProviderRegistryService>();
builder.Services.AddSingleton<IModelRegistry, ModelRegistryService>();
builder.Services.AddSingleton<AIConfigurationService>();
builder.Services.AddSingleton<INoAiModeService, NoAiModeService>();
builder.Services.AddSingleton<IComboRootService, ComboRootService>();
builder.Services.AddHttpClient<IPrepMateAIClient, PrepMateAIClient>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(60);
});
builder.Services.AddSingleton<IAIRouter, AIRouter>();
builder.Services.AddHttpClient<IAIProviderAdapter, OpenAIChatCompletionsAdapter>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(60);
});
builder.Services.AddHttpClient<GeminiService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(60);
});
builder.Services.AddHttpClient<backend.Services.AI.IVilaoModelDiscoveryService, backend.Services.AI.VilaoModelDiscoveryService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(20);
});
builder.Services.AddHttpClient<backend.Services.TTS.IElevenLabsTtsService, backend.Services.TTS.ElevenLabsTtsService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddScoped<AnswerAnalysisService>();
builder.Services.AddScoped<AdaptiveInterviewEngine>();
builder.Services.AddScoped<QuestionGenerationService>();
builder.Services.AddScoped<KnowledgeBlueprintService>();
builder.Services.AddScoped<KnowledgeBlueprintEnrichmentService>();
builder.Services.AddScoped<KnowledgeCoverageService>();
builder.Services.AddScoped<CompanyIntelligenceService>();
builder.Services.AddSingleton<IKnowledgeRepository, KnowledgeRepositoryService>();
builder.Services.AddScoped<InterviewStrategyService>();
builder.Services.AddScoped<InterviewStageOrchestrator>();
builder.Services.AddScoped<IInterviewStageOrchestrator, InterviewStageOrchestrator>();
builder.Services.AddScoped<InterviewContextBuilder>();
builder.Services.AddScoped<InterviewFlowService>();
builder.Services.AddScoped<InterviewReportService>();
builder.Services.AddScoped<LegacyQuestionService>();
builder.Services.AddScoped<CvAnalysisService>();
builder.Services.AddScoped<JobRecommendationService>();
builder.Services.AddScoped<CareerRoadmapService>();
builder.Services.AddScoped<IFinalEvaluationService, FinalEvaluationService>();
builder.Services.AddScoped<IEvidenceReportService, EvidenceReportService>();
builder.Services.AddScoped<IInterviewPerformanceService, InterviewPerformanceService>();
builder.Services.AddScoped<IDiagnosticAnalysisService, DiagnosticAnalysisService>();
builder.Services.AddScoped<IImprovementRoadmapService, ImprovementRoadmapService>();
builder.Services.AddScoped<IInterviewPreparationService, InterviewPreparationService>();
builder.Services.AddScoped<IBehavioralInterviewService, BehavioralInterviewService>();
builder.Services.AddScoped<BehavioralInterviewService>();
builder.Services.AddScoped<ISituationalInterviewService, SituationalInterviewService>();
builder.Services.AddScoped<SituationalInterviewService>();
builder.Services.AddScoped<ICandidateQuestionService, CandidateQuestionService>();
builder.Services.AddScoped<CandidateQuestionService>();
builder.Services.AddScoped<IClosingService, ClosingService>();
builder.Services.AddScoped<ClosingService>();
builder.Services.AddScoped<IInterviewerIntelligenceService, InterviewerIntelligenceService>();
builder.Services.AddScoped<InterviewerIntelligenceService>();
builder.Services.AddScoped<IInterviewQualityService, InterviewQualityService>();
builder.Services.AddScoped<InterviewQualityService>();
builder.Services.AddScoped<IPresenceObservationService, PresenceObservationService>();
builder.Services.AddScoped<PresenceObservationService>();
builder.Services.AddScoped<ISpeechObservationService, SpeechObservationService>();
builder.Services.AddScoped<SpeechObservationService>();
builder.Services.AddScoped<IInterviewConductService, InterviewConductService>();
builder.Services.AddScoped<InterviewConductService>();
builder.Services.AddScoped<IRealTimeFeedbackCalibrationService, RealTimeFeedbackCalibrationService>();
builder.Services.AddScoped<RealTimeFeedbackCalibrationService>();
builder.Services.AddScoped<IInterviewReadinessService, InterviewReadinessService>();
builder.Services.AddSingleton<IInterviewQuotaService, InterviewQuotaService>();
builder.Services.AddSingleton<InterviewQuotaService>();
builder.Services.AddScoped<InterviewReadinessService>();

// Register JWT Security Services & Bearer Authentication
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();
builder.Services.AddSingleton<JwtTokenService>();

var envName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
    ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");
var isProductionEnv = string.Equals(envName, "Production", StringComparison.OrdinalIgnoreCase);

var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? Environment.GetEnvironmentVariable("JWT__SECRET")
;

if (string.IsNullOrWhiteSpace(jwtSecret))
{
    if (isProductionEnv)
    {
        throw new InvalidOperationException("Production configuration error: JWT signing key (Jwt:Secret or JWT__SECRET) is required and cannot be empty.");
    }
    jwtSecret = JwtTokenService.DefaultDevSecret;
}
else if (jwtSecret.Length < 32)
{
    if (isProductionEnv)
    {
        throw new InvalidOperationException("Production configuration error: JWT signing key (Jwt:Secret or JWT__SECRET) must be at least 32 characters (256 bits).");
    }
    jwtSecret = jwtSecret.PadRight(32, '!');
}

var guestSecret = builder.Configuration["GuestToken:SigningKey"]
    ?? Environment.GetEnvironmentVariable("GUEST_TOKEN__SIGNING_KEY")
    ?? Environment.GetEnvironmentVariable("GUEST_TOKEN_SIGNING_KEY");

if (string.IsNullOrWhiteSpace(guestSecret))
{
    if (isProductionEnv)
    {
        throw new InvalidOperationException("Production configuration error: Guest token signing key (GuestToken:SigningKey or GUEST_TOKEN__SIGNING_KEY) is required and cannot be empty.");
    }
}
else if (guestSecret.Length < 32)
{
    if (isProductionEnv)
    {
        throw new InvalidOperationException("Production security error: Guest token signing key (GuestToken:SigningKey or GUEST_TOKEN__SIGNING_KEY) must be at least 32 characters (256 bits).");
    }
}

if (!string.IsNullOrWhiteSpace(guestSecret) && !string.IsNullOrWhiteSpace(jwtSecret) &&
    string.Equals(guestSecret, jwtSecret, StringComparison.Ordinal))
{
    if (isProductionEnv)
    {
        throw new InvalidOperationException("Production configuration error: GuestToken:SigningKey and Jwt:Secret must not use the same signing key. Cryptographic key separation is required.");
    }
}
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "PrepMateBackend";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "PrepMateFrontend";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            RoleClaimType = ClaimTypes.Role,
            NameClaimType = ClaimTypes.NameIdentifier
        };
    });
builder.Services.AddAuthorization();


var app = builder.Build();

// Initialize FileDb at application startup
app.Services.GetRequiredService<FileDb>();

// Global Exception Sanitizer Middleware (prevents information disclosure)
app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[UNHANDLED ERROR] {ex.GetType().Name}: {ex.Message}");
        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/json; charset=utf-8";
            await context.Response.WriteAsync("{\"error\":\"Đã xảy ra sự cố nội bộ trong quá trình xử lý.\"}");
        }
    }
});

// Forwarded Headers Middleware (must run before routing, scheme inspection & HTTPS redirection)
app.UseForwardedHeaders();

// HTTP Security Headers & Cache-Control Middleware (SEC SSOT)
app.Use(async (context, next) =>
{
    context.Response.Headers.TryAdd("X-Content-Type-Options", "nosniff");
    context.Response.Headers.TryAdd("X-Frame-Options", "SAMEORIGIN");
    context.Response.Headers.TryAdd("Referrer-Policy", "strict-origin-when-cross-origin");
    context.Response.Headers.TryAdd("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
    context.Response.Headers.TryAdd("Content-Security-Policy-Report-Only", "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:; object-src 'none'; frame-ancestors 'self';");
    if (context.Request.Path.StartsWithSegments("/api") || context.Request.Path.Value?.EndsWith(".html", StringComparison.OrdinalIgnoreCase) == true || context.Request.Path == "/")
    {
        context.Response.Headers.TryAdd("Cache-Control", "no-store, no-cache, must-revalidate");
        context.Response.Headers.TryAdd("Pragma", "no-cache");
    }
    await next();
});

// Response Compression Middleware
app.UseResponseCompression();

// Enable CORS
if (app.Environment.IsProduction() && allowedCorsOrigins.Length > 0)
{
    app.UseCors("ProductionCorsPolicy");
}
else
{
    app.UseCors("AllowAll");
}

// Serve frontend from wwwroot (standard ASP.NET Core static files)
app.UseDefaultFiles(); // serves index.html by default at "/"
app.Use(async (context, next) =>
{
    if (context.Request.Path.Equals("/auth.html", StringComparison.OrdinalIgnoreCase))
    {
        context.Response.Redirect("/features/auth/auth.html");
        return;
    }
    await next();
});
app.UseStaticFiles();  // serves wwwroot/**

app.UseRouting();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();

// Health Check Endpoint for reverse proxy, container orchestration & monitoring
app.MapGet("/health", () => Results.Ok(new { status = "ok", message = "PrepMate server đang chạy!", timestamp = DateTime.UtcNow.ToString("o") }));

app.Run();


