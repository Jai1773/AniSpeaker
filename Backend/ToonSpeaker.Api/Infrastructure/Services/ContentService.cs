using Microsoft.EntityFrameworkCore;
using ToonSpeaker.Api.Application;
using ToonSpeaker.Api.Domain;
using ToonSpeaker.Api.Infrastructure.Persistence;

namespace ToonSpeaker.Api.Infrastructure.Services;

public sealed class ContentService(AppDbContext db, IStorageService storage) : IContentService
{
    public async Task<PageResult<ContentSummaryDto>> BrowseAsync(Guid? category, ContentType? type, int page, int pageSize, bool includeUnpublished, CancellationToken ct)
    {
        var query = db.Content.AsNoTracking().AsQueryable();
        if (!includeUnpublished) query = query.Where(x => x.Published);
        if (category.HasValue) query = query.Where(x => x.CategoryId == category);
        if (type.HasValue) query = query.Where(x => x.Type == type);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.UpdatedAt).Skip((page - 1) * pageSize).Take(pageSize).Select(x => ToSummary(x)).ToListAsync(ct);
        return new PageResult<ContentSummaryDto>(items, page, pageSize, total);
    }

    public async Task<ContentDetailDto?> GetBySlugAsync(string slug, bool includeUnpublished, CancellationToken ct)
    {
        var query = db.Content.AsNoTracking().Include(x => x.Seasons).ThenInclude(x => x.Episodes).Include(x => x.Episodes).AsQueryable();
        if (!includeUnpublished) query = query.Where(x => x.Published);
        var item = await query.SingleOrDefaultAsync(x => x.Slug == slug, ct);
        return item is null ? null : ToDetail(item, includeUnpublished);
    }

    public async Task<IReadOnlyList<ContentSummaryDto>> SearchAsync(string query, CancellationToken ct) => await db.Content.AsNoTracking()
        .Where(x => x.Published && (EF.Functions.ILike(x.Title, $"%{query}%") || (x.Description != null && EF.Functions.ILike(x.Description, $"%{query}%"))))
        .OrderByDescending(x => x.UpdatedAt).Take(20).Select(x => ToSummary(x)).ToListAsync(ct);

    public async Task<PlaybackDto?> GetPlaybackAsync(Guid episodeId, CancellationToken ct)
    {
        var episode = await db.Episodes.AsNoTracking().Include(x => x.Content).SingleOrDefaultAsync(x => x.Id == episodeId && x.Published && x.Content.Published, ct);
        return episode is null || string.IsNullOrWhiteSpace(episode.VideoKey) ? null : await storage.CreateReadUrlAsync(episode.Id, episode.VideoKey, ct);
    }

    public static ContentSummaryDto ToSummary(Content x) => new(x.Id, x.CategoryId, x.Title, x.Slug, x.Type, x.Description, x.PosterUrl, x.BannerUrl, x.Tags, x.Published);
    public static EpisodeDto ToEpisode(Episode x) => new(x.Id, x.ContentId, x.SeasonId, x.Number, x.Title, x.ThumbnailUrl, x.DurationSeconds, x.Published);
    public static ContentDetailDto ToDetail(Content x, bool includeUnpublished) => new(x.Id, x.CategoryId, x.Title, x.Slug, x.Type, x.Description, x.PosterUrl, x.BannerUrl, x.Tags, x.Published,
        x.Seasons.OrderBy(s => s.Number).Select(s => new SeasonDto(s.Id, s.Number, s.Title, s.Episodes.Where(e => includeUnpublished || e.Published).OrderBy(e => e.Number).Select(ToEpisode).ToList())).ToList(),
        x.Episodes.Where(e => e.SeasonId == null && (includeUnpublished || e.Published)).OrderBy(e => e.Number).Select(ToEpisode).ToList());
}
