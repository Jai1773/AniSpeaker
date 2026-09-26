using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ToonSpeaker.Api.Domain;
using ToonSpeaker.Api.Infrastructure.Persistence;

// Npgsql key=value format — bypasses the postgres:// URL parsing in the main API's Program.cs
const string ConnectionString =
    "Host=ep-weathered-sunset-a5aeopa8-pooler.us-east-2.aws.neon.tech;Port=5432;" +
    "Database=neondb;Username=neondb_owner;Password=npg_KIjQdDAH19ZF;" +
    "SSL Mode=Require;Channel Binding=require";

// ─── Build a minimal host just for EF Core + Identity ────────────────────────
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(ConnectionString));
builder.Services.AddIdentityCore<AppUser>()
    .AddRoles<Microsoft.AspNetCore.Identity.IdentityRole<Guid>>()
    .AddEntityFrameworkStores<AppDbContext>();

var app = builder.Build();

using var scope = app.Services.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

Console.WriteLine("=== AniSpeaker JSON → PostgreSQL Migration ===\n");

// ─── 1. Ensure categories exist ───────────────────────────────────────────────
Console.WriteLine("Step 1: Seeding categories...");

var categoryMap = new Dictionary<string, Guid>(); // slug → id

var seedCategories = new[]
{
    ("Anime",    "anime",    1),
    ("Cartoon",  "cartoon",  2),
    ("Movie",    "movie",    3),
    ("Action",   "action",   4),
    ("Sci-Fi",   "sci-fi",   5),
    ("Fantasy",  "fantasy",  6),
    ("Adventure","adventure",7),
    ("Comedy",   "comedy",   8),
    ("Drama",    "drama",    9),
    ("Kids",     "kids",     10),
    ("Mystery",  "mystery",  11),
    ("Family",   "family",   12),
};

foreach (var (name, slug, order) in seedCategories)
{
    var existing = await db.Categories.FirstOrDefaultAsync(c => c.Slug == slug);
    if (existing is null)
    {
        existing = new Category { Name = name, Slug = slug, SortOrder = order };
        db.Categories.Add(existing);
        await db.SaveChangesAsync();
        Console.WriteLine($"  Created category: {name}");
    }
    categoryMap[slug] = existing.Id;
}

// ─── 2. Old JSON data (from frontend fallbackItems) ───────────────────────────
Console.WriteLine("\nStep 2: Migrating old JSON content items...\n");

var oldItems = new[];

int imported = 0, skipped = 0;

foreach (var item in oldItems)
{
    // Skip if already imported (idempotent by slug)
    if (await db.Content.AnyAsync(c => c.Slug == item.Slug))
    {
        Console.WriteLine($"  SKIP  [{item.Type}] '{item.Title}' (slug already exists)");
        skipped++;
        continue;
    }

    if (!categoryMap.TryGetValue(item.CategorySlug, out var catId))
    {
        Console.WriteLine($"  WARN  No category found for slug '{item.CategorySlug}', skipping '{item.Title}'");
        continue;
    }

    // Create Content
    var content = new Content
    {
        CategoryId  = catId,
        Title       = item.Title,
        Slug        = item.Slug,
        Type        = item.Type,
        Description = item.Description,
        PosterUrl   = item.PosterUrl,
        BannerUrl   = item.BannerUrl,
        Tags        = item.Tags,
        Published   = true,
    };
    db.Content.Add(content);
    await db.SaveChangesAsync();

    // For Series: create Season 1 and add episodes under it
    // For Movie: add episodes directly (no season)
    if (item.Type == ContentType.Series)
    {
        var season = new Season { ContentId = content.Id, Number = 1, Title = "Season 1" };
        db.Seasons.Add(season);
        await db.SaveChangesAsync();

        foreach (var ep in item.Episodes)
        {
            var episode = new Episode
            {
                ContentId       = content.Id,
                SeasonId        = season.Id,
                Number          = ep.Number,
                Title           = ep.Title,
                ThumbnailUrl    = ep.ThumbnailUrl,
                DurationSeconds = ep.DurationSeconds,
                Published       = true,
            };
            db.Episodes.Add(episode);
            await db.SaveChangesAsync();

            // Add the video URL as first VideoSource (player = "Direct MP4")
            if (!string.IsNullOrWhiteSpace(ep.VideoUrl))
            {
                db.VideoSources.Add(new VideoSource
                {
                    EpisodeId  = episode.Id,
                    PlayerName = "Direct MP4",
                    Url        = ep.VideoUrl,
                    Quality    = null,
                    SortOrder  = 0,
                    IsActive   = true
                });
                await db.SaveChangesAsync();
            }
        }
    }
    else // Movie
    {
        foreach (var ep in item.Episodes)
        {
            var episode = new Episode
            {
                ContentId       = content.Id,
                SeasonId        = null, // no season for movies
                Number          = ep.Number,
                Title           = ep.Title,
                ThumbnailUrl    = ep.ThumbnailUrl,
                DurationSeconds = ep.DurationSeconds,
                Published       = true,
            };
            db.Episodes.Add(episode);
            await db.SaveChangesAsync();

            if (!string.IsNullOrWhiteSpace(ep.VideoUrl))
            {
                db.VideoSources.Add(new VideoSource
                {
                    EpisodeId  = episode.Id,
                    PlayerName = "Direct MP4",
                    Url        = ep.VideoUrl,
                    Quality    = null,
                    SortOrder  = 0,
                    IsActive   = true
                });
                await db.SaveChangesAsync();
            }
        }
    }

    Console.WriteLine($"  OK    [{item.Type}] '{item.Title}' → {item.Episodes.Length} episode(s) + VideoSource rows");
    imported++;
}

Console.WriteLine($"\n✅ Migration complete. Imported: {imported}  Skipped (already existed): {skipped}");

// ─── 3. Show final counts ─────────────────────────────────────────────────────
Console.WriteLine("\nFinal DB counts:");
Console.WriteLine($"  Categories : {await db.Categories.CountAsync()}");
Console.WriteLine($"  Content    : {await db.Content.CountAsync()}");
Console.WriteLine($"  Seasons    : {await db.Seasons.CountAsync()}");
Console.WriteLine($"  Episodes   : {await db.Episodes.CountAsync()}");
Console.WriteLine($"  VideoSources: {await db.VideoSources.CountAsync()}");

// ─── Record types ─────────────────────────────────────────────────────────────
record OldItem(
    string Title, string Slug, ContentType Type, string CategorySlug,
    string[] Tags, string Description, string PosterUrl, string BannerUrl,
    OldEpisode[] Episodes);

record OldEpisode(int Number, string Title, int DurationSeconds, string ThumbnailUrl, string VideoUrl);
