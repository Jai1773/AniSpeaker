using System.Net;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Npgsql;
using ToonSpeaker.Api.Application;
using ToonSpeaker.Api.Domain;
using ToonSpeaker.Api.Infrastructure.Persistence;
using ToonSpeaker.Api.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

// ─── Forwarded headers (Render / Cloudflare terminate TLS at the edge) ───────
// Makes Request.IsHttps correct inside the container.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddProblemDetails();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Toon Speaker API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste a JWT access token to authorize protected endpoints."
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// ─── Database ─────────────────────────────────────────────────────────────────
var connectionString = ToNpgsqlConnectionString(builder.Configuration.GetConnectionString("Default"));
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));

// ─── Identity ─────────────────────────────────────────────────────────────────
builder.Services.AddIdentityCore<AppUser>(options =>
    {
        options.Password.RequiredLength = 8;
        options.User.RequireUniqueEmail = true;
    })
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();

// ─── JWT ──────────────────────────────────────────────────────────────────────
var jwt = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
if (jwt.Secret.Length < 32)
    throw new InvalidOperationException(
        "Jwt:Secret must be at least 32 characters. Set Jwt__Secret in Render environment variables.");
builder.Services.AddSingleton(jwt);

// ─── R2 / Storage ─────────────────────────────────────────────────────────────
builder.Services.AddSingleton(builder.Configuration.GetSection("R2").Get<R2Options>() ?? new R2Options());

// ─── Application services ─────────────────────────────────────────────────────
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<IStorageService, R2StorageService>();
builder.Services.AddScoped<IContentService, ContentService>();

// ─── Authentication ───────────────────────────────────────────────────────────
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = jwt.Issuer,
        ValidateAudience = true,
        ValidAudience = jwt.Audience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Secret)),
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromSeconds(30)
    });
builder.Services.AddAuthorization();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Override on Render: Cors__AllowedOrigins__0=https://yourapp.pages.dev
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:4200"];

builder.Services.AddCors(options =>
    options.AddPolicy("Frontend", policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));

// ═════════════════════════════════════════════════════════════════════════════
var app = builder.Build();
// ═════════════════════════════════════════════════════════════════════════════

// ForwardedHeaders must come first — makes Request.IsHttps correct for all subsequent middleware.
app.UseForwardedHeaders();

// Return JSON ProblemDetails on unhandled exceptions instead of an empty 500 body.
app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
    context.Response.ContentType = "application/problem+json";

    var feature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerPathFeature>();
    var error = feature?.Error;

    var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
    logger.LogError(error, "Unhandled exception on {Method} {Path}", context.Request.Method, context.Request.Path);

    var detail = app.Environment.IsDevelopment() ? error?.ToString() : "An unexpected error occurred.";
    await context.Response.WriteAsJsonAsync(new
    {
        type = "https://httpstatuses.io/500",
        title = "Internal Server Error",
        status = 500,
        detail
    });
}));

// NOTE: No UseHttpsRedirection — Render/Cloudflare terminate TLS at the edge.
// The container listens on plain HTTP port 8080; adding UseHttpsRedirection
// here caused an infinite redirect loop.

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => Results.Ok(new { name = "Toon Speaker API", status = "running", health = "/health" }));
app.MapControllers();

// ─── Database migrations ──────────────────────────────────────────────────────
// Must run BEFORE app.Run() — app.Run() is a blocking call, nothing after it executes.
// Enable on Render first deploy via: Database__ApplyMigrations=true
// Remove the env var after migrations succeed.
if (app.Configuration.GetValue<bool>("Database:ApplyMigrations"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        await db.Database.MigrateAsync();
        app.Logger.LogInformation("Database migrations are up to date.");
    }
    catch (Exception ex)
    {
        app.Logger.LogCritical(ex,
            "Database migration failed. Verify ConnectionStrings__Default is set correctly in Render " +
            "and that the Neon database is accessible.");
        throw;
    }
}

app.Run();

// ─── Helpers ──────────────────────────────────────────────────────────────────
static string ToNpgsqlConnectionString(string? configuredValue)
{
    if (string.IsNullOrWhiteSpace(configuredValue))
        throw new InvalidOperationException(
            "ConnectionStrings:Default is required. Set ConnectionStrings__Default in Render to the " +
            "Neon PostgreSQL connection string (postgres://user:pass@host/db?sslmode=require).");

    // Already a key=value Npgsql string — pass through unchanged.
    if (!Uri.TryCreate(configuredValue, UriKind.Absolute, out var uri) ||
        (uri.Scheme is not "postgres" and not "postgresql"))
        return configuredValue;

    // Parse a postgres:// URL from the Neon dashboard into Npgsql key=value format.
    var userInfo = uri.UserInfo.Split(':', 2);
    var database = Uri.UnescapeDataString(uri.AbsolutePath.Trim('/'));
    if (userInfo.Length != 2 || string.IsNullOrWhiteSpace(uri.Host) || string.IsNullOrWhiteSpace(database))
        throw new InvalidOperationException("ConnectionStrings:Default contains an invalid PostgreSQL URL.");

    var npgsql = new NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.IsDefaultPort ? 5432 : uri.Port,
        Database = database,
        Username = Uri.UnescapeDataString(userInfo[0]),
        Password = Uri.UnescapeDataString(userInfo[1])
    };

    // Forward query params — map postgres URL param names to Npgsql key=value names.
    // Neon sends: sslmode=require&channel_binding=require
    foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
    {
        var kv = pair.Split('=', 2);
        var rawKey = Uri.UnescapeDataString(kv[0]);
        var value  = kv.Length == 2 ? Uri.UnescapeDataString(kv[1]) : string.Empty;

        // Map postgres URL parameter names → Npgsql connection string key names
        var npgsqlKey = rawKey.ToLowerInvariant() switch
        {
            "sslmode"         => "SSL Mode",
            "channel_binding" => "Channel Binding",
            _                 => rawKey           // pass any other params through as-is
        };

        npgsql[npgsqlKey] = value;
    }

    return npgsql.ConnectionString;
}

public partial class Program;
