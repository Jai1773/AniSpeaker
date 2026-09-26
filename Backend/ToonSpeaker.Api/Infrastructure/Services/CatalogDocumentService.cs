using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ToonSpeaker.Api.Application;
using ToonSpeaker.Api.Infrastructure.Persistence;

namespace ToonSpeaker.Api.Infrastructure.Services;

/// <summary>Stores the complete catalog item as one PostgreSQL jsonb document.</summary>
public sealed class CatalogDocumentService(AppDbContext db)
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    public async Task SyncAsync(Guid contentId, CancellationToken ct)
    {
        var content = await db.Content
            .Include(x => x.Seasons).ThenInclude(x => x.Episodes).ThenInclude(x => x.VideoSources)
            .Include(x => x.Episodes).ThenInclude(x => x.VideoSources)
            .SingleOrDefaultAsync(x => x.Id == contentId, ct);

        if (content is null) return;

        var document = new ContentDetailDto(
            content.Id,
            content.CategoryId,
            content.Title,
            content.Slug,
            content.Type,
            content.Description,
            content.PosterUrl,
            content.BannerUrl,
            content.Tags,
            content.Published,
            content.Seasons
                .OrderBy(x => x.Number)
                .Select(season => new SeasonDto(
                    season.Id,
                    season.Number,
                    season.Title,
                    season.Episodes.OrderBy(x => x.Number).Select(ContentService.ToEpisode).ToList()))
                .ToList(),
            content.Episodes
                .Where(x => x.SeasonId is null)
                .OrderBy(x => x.Number)
                .Select(ContentService.ToEpisode)
                .ToList());

        content.CatalogJson = JsonSerializer.SerializeToDocument(document, Options);
        content.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public static ContentDetailDto? Read(JsonDocument? document) =>
        document is null ? null : document.Deserialize<ContentDetailDto>(Options);
}
