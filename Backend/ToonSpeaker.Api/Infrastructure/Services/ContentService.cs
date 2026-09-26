using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ToonSpeaker.Api.Application;
using ToonSpeaker.Api.Domain;
using ToonSpeaker.Api.Infrastructure.Persistence;

namespace ToonSpeaker.Api.Infrastructure.Services;

public sealed class ContentService(AppDbContext db, IMemoryCache? cache = null) : IContentService
{
    public async Task<PageResult<ContentSummaryDto>> BrowseAsync(
        Guid? category, ContentType? type, int page, int pageSize,
        bool includeUnpublished, CancellationToken ct)
    {
        var cacheKey = $"browse_{category}_{type}_{page}_{pageSize}_{includeUnpublished}";
        if (cache is not null && cache.TryGetValue(cacheKey, out PageResult<ContentSummaryDto>? cached) && cached is not null)
        {
            return cached;
        }

        var query = db.Content.AsNoTracking().AsQueryable();
        if (!includeUnpublished) query = query.Where(x => x.Published);
        if (category.HasValue)   query = query.Where(x => x.CategoryId == category);
        if (type.HasValue)       query = query.Where(x => x.Type == type);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => ToSummary(x))
            .ToListAsync(ct);

        var result = new PageResult<ContentSummaryDto>(items, page, pageSize, total);
        cache?.Set(cacheKey, result, TimeSpan.FromSeconds(60));
        return result;
    }

    public async Task<ContentDetailDto?> GetBySlugAsync(string slug, bool includeUnpublished, CancellationToken ct)
    {
        var cacheKey = $"slug_{slug.ToLowerInvariant()}_{includeUnpublished}";
        if (cache is not null && cache.TryGetValue(cacheKey, out ContentDetailDto? cached) && cached is not null)
        {
            return cached;
        }

        var query = db.Content.AsNoTracking()
            .Include(x => x.Seasons).ThenInclude(s => s.Episodes).ThenInclude(e => e.VideoSources)
            .Include(x => x.Episodes).ThenInclude(e => e.VideoSources)
            .AsQueryable();

        if (!includeUnpublished) query = query.Where(x => x.Published);

        var item = await query.SingleOrDefaultAsync(x => x.Slug == slug, ct);
        if (item is null) return null;
        var document = CatalogDocumentService.Read(item.CatalogJson);
        var detail = document is not null && (includeUnpublished || document.Published)
            ? document
            : ToDetail(item, includeUnpublished);

        cache?.Set(cacheKey, detail, TimeSpan.FromSeconds(60));
        return detail;
    }

    public async Task<IReadOnlyList<ContentSummaryDto>> SearchAsync(string query, CancellationToken ct) =>
        await db.Content.AsNoTracking()
            .Where(x => x.Published &&
                        (EF.Functions.ILike(x.Title, $"%{query}%") ||
                         (x.Description != null && EF.Functions.ILike(x.Description, $"%{query}%"))))
            .OrderByDescending(x => x.UpdatedAt)
            .Take(20)
            .Select(x => ToSummary(x))
            .ToListAsync(ct);

    public async Task<PlaybackSourcesDto?> GetPlaybackAsync(Guid episodeId, CancellationToken ct)
    {
        var episode = await db.Episodes.AsNoTracking()
            .Include(x => x.VideoSources)
            .Include(x => x.Content)
            .SingleOrDefaultAsync(x => x.Id == episodeId && x.Published && x.Content.Published, ct);

        if (episode is null) return null;

        var sources = episode.VideoSources
            .Where(s => s.IsActive)
            .OrderBy(s => s.SortOrder)
            .Select(ToVideoSource)
            .ToList();

        return new PlaybackSourcesDto(episode.Id, sources);
    }

    public async Task<CompositeDetailDto?> GetCompositeDetailAsync(string slug, Guid? userId, bool includeUnpublished, CancellationToken ct)
    {
        var detail = await GetBySlugAsync(slug, includeUnpublished, ct);
        if (detail is null) return null;

        var related = await db.Content.AsNoTracking()
            .Where(x => x.CategoryId == detail.CategoryId && x.Slug != detail.Slug && (includeUnpublished || x.Published))
            .OrderByDescending(x => x.UpdatedAt)
            .Take(6)
            .Select(x => ToSummary(x))
            .ToListAsync(ct);

        bool isSaved = false;
        return new CompositeDetailDto(detail, related, isSaved);
    }

    // ─── Static projection helpers ─────────────────────────────────────────────

    public static ContentSummaryDto ToSummary(Content x) =>
        new(x.Id, x.CategoryId, x.Title, x.Slug, x.Type,
            x.Description, x.PosterUrl, x.BannerUrl, x.Tags, x.Published);

    public static VideoSourceDto ToVideoSource(VideoSource s) =>
        new(s.Id, s.PlayerName, s.Url, s.EmbedType, s.Quality, s.SortOrder);

    public static EpisodeDto ToEpisode(Episode x) =>
        new(x.Id, x.ContentId, x.SeasonId, x.Number, x.Title,
            x.ThumbnailUrl, x.DurationSeconds, x.Published,
            x.VideoSources
                .Where(s => s.IsActive)
                .OrderBy(s => s.SortOrder)
                .Select(ToVideoSource)
                .ToList());

    public static ContentDetailDto ToDetail(Content x, bool includeUnpublished) =>
        new(x.Id, x.CategoryId, x.Title, x.Slug, x.Type,
            x.Description, x.PosterUrl, x.BannerUrl, x.Tags, x.Published,
            x.Seasons
                .OrderBy(s => s.Number)
                .Select(s => new SeasonDto(s.Id, s.Number, s.Title,
                    s.Episodes
                        .Where(e => includeUnpublished || e.Published)
                        .OrderBy(e => e.Number)
                        .Select(ToEpisode)
                        .ToList()))
                .ToList(),
            x.Episodes
                .Where(e => e.SeasonId == null && (includeUnpublished || e.Published))
                .OrderBy(e => e.Number)
                .Select(ToEpisode)
                .ToList());
}
