using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ToonSpeaker.Api.Application;
using ToonSpeaker.Api.Domain;
using ToonSpeaker.Api.Infrastructure.Persistence;
using ToonSpeaker.Api.Infrastructure.Services;

namespace ToonSpeaker.Api.Controllers.Admin;

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>Admin CRUD for content categories.</summary>
[ApiController, Authorize(Roles = "Admin"), Route("api/admin/categories")]
public sealed class AdminCategoryController(AppDbContext db) : ControllerBase
{
    /// <summary>List all categories ordered by SortOrder.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CategoryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> List(CancellationToken ct) =>
        Ok(await db.Categories.AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .Select(x => new CategoryDto(x.Id, x.Name, x.Slug, x.SortOrder))
            .ToListAsync(ct));

    /// <summary>Create a new category.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(CategoryDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CategoryDto>> Create(CreateCategoryRequest r, CancellationToken ct)
    {
        var x = new Category { Name = r.Name, Slug = r.Slug, SortOrder = r.SortOrder };
        db.Categories.Add(x);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(List), new CategoryDto(x.Id, x.Name, x.Slug, x.SortOrder));
    }

    /// <summary>Update an existing category.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, UpdateCategoryRequest r, CancellationToken ct)
    {
        var x = await db.Categories.FindAsync([id], ct);
        if (x is null) return NotFound();
        x.Name = r.Name; x.Slug = r.Slug; x.SortOrder = r.SortOrder;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Delete a category (will fail if content is still assigned to it).</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var x = await db.Categories.FindAsync([id], ct);
        if (x is null) return NotFound();
        db.Categories.Remove(x);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT (Series & Movies)
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>Admin CRUD for content (series and movies) and seasons.</summary>
[ApiController, Authorize(Roles = "Admin"), Route("api/admin/content")]
public sealed class AdminContentController(AppDbContext db, IContentService content, CatalogDocumentService catalog) : ControllerBase
{
    /// <summary>Browse/search all content (including unpublished).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(PageResult<ContentSummaryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PageResult<ContentSummaryDto>>> List(
        [FromQuery] string? search,
        [FromQuery] Guid? category,
        [FromQuery] ContentType? type,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 24,
        CancellationToken ct = default)
    {
        if (page < 1 || pageSize is < 1 or > 100)
            return ValidationProblem("page must be ≥ 1 and pageSize must be between 1 and 100.");

        // If a search term is provided, filter by title or description
        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim();
            var query = db.Content.AsNoTracking()
                .Where(x => EF.Functions.ILike(x.Title, $"%{q}%") ||
                            (x.Description != null && EF.Functions.ILike(x.Description, $"%{q}%")));
            if (category.HasValue) query = query.Where(x => x.CategoryId == category);
            if (type.HasValue)     query = query.Where(x => x.Type == type);

            var total = await query.CountAsync(ct);
            var items = await query
                .OrderByDescending(x => x.UpdatedAt)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(x => ContentService.ToSummary(x))
                .ToListAsync(ct);
            return Ok(new PageResult<ContentSummaryDto>(items, page, pageSize, total));
        }

        return Ok(await content.BrowseAsync(category, type, page, pageSize, true, ct));
    }

    /// <summary>Create new content (series or movie).</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ContentSummaryDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ContentSummaryDto>> Create(SaveContentRequest r, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(r.Title) || string.IsNullOrWhiteSpace(r.Slug))
            return ValidationProblem("Title and slug are required.");
        if (r.Type is not (ContentType.Series or ContentType.Movie))
            return ValidationProblem("Content type must be Series or Movie.");
        if (!await db.Categories.AnyAsync(x => x.Id == r.CategoryId, ct))
            return ValidationProblem("Category does not exist.");

        var x = NewContent(r);
        db.Content.Add(x);
        await db.SaveChangesAsync(ct);
        await catalog.SyncAsync(x.Id, ct);
        return Created($"/api/admin/content/{x.Id}", ContentService.ToSummary(x));
    }

    /// <summary>Update content metadata.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, SaveContentRequest r, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(r.Title) || string.IsNullOrWhiteSpace(r.Slug))
            return ValidationProblem("Title and slug are required.");
        var x = await db.Content.FindAsync([id], ct);
        if (x is null) return NotFound();
        Apply(x, r);
        await db.SaveChangesAsync(ct);
        await catalog.SyncAsync(x.Id, ct);
        return NoContent();
    }

    /// <summary>Delete content and all its seasons, episodes, and video sources.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var x = await db.Content.FindAsync([id], ct);
        if (x is null) return NotFound();
        db.Content.Remove(x);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Add a season to a series.</summary>
    [HttpPost("{contentId:guid}/seasons")]
    [ProducesResponseType(typeof(SeasonDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SeasonDto>> CreateSeason(Guid contentId, CreateSeasonRequest r, CancellationToken ct)
    {
        if (!await db.Content.AnyAsync(x => x.Id == contentId, ct)) return NotFound();
        var x = new Season { ContentId = contentId, Number = r.Number, Title = r.Title };
        db.Seasons.Add(x);
        await db.SaveChangesAsync(ct);
        await catalog.SyncAsync(contentId, ct);
        return Ok(new SeasonDto(x.Id, x.Number, x.Title, []));
    }

    /// <summary>
    /// Add an episode directly to a movie (no season required).
    /// Use this for Movie-type content; for Series use the seasons/{seasonId}/episodes endpoint.
    /// </summary>
    [HttpPost("{contentId:guid}/episodes")]
    [ProducesResponseType(typeof(EpisodeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<EpisodeDto>> CreateEpisodeForMovie(
        Guid contentId, SaveEpisodeRequest r, CancellationToken ct)
    {
        var content2 = await db.Content.FindAsync([contentId], ct);
        if (content2 is null) return NotFound();
        if (content2.Type != ContentType.Movie)
            return ValidationProblem("Use the seasons/{seasonId}/episodes endpoint for Series content.");
        if (r.Number < 1 || string.IsNullOrWhiteSpace(r.Title))
            return ValidationProblem("Episode number and title are required.");

        var ep = new Episode
        {
            ContentId = contentId,
            SeasonId  = null,
            Number    = r.Number,
            Title     = r.Title,
            ThumbnailUrl    = r.ThumbnailUrl,
            DurationSeconds = r.DurationSeconds,
            Published       = r.Published
        };
        db.Episodes.Add(ep);
        await db.SaveChangesAsync(ct);
        await catalog.SyncAsync(ep.ContentId, ct);
        return Created($"/api/admin/episodes/{ep.Id}/sources",
            new EpisodeDto(ep.Id, ep.ContentId, ep.SeasonId, ep.Number, ep.Title,
                ep.ThumbnailUrl, ep.DurationSeconds, ep.Published, []));
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private static Content NewContent(SaveContentRequest r) { var x = new Content(); Apply(x, r); return x; }

    private static void Apply(Content x, SaveContentRequest r)
    {
        x.CategoryId  = r.CategoryId;
        x.Title       = r.Title;
        x.Slug        = r.Slug;
        x.Type        = r.Type;
        x.Description = r.Description;
        x.PosterUrl   = r.PosterUrl;
        x.BannerUrl   = r.BannerUrl;
        x.Tags        = r.Tags ?? [];
        x.Published   = r.Published;
        x.UpdatedAt   = DateTimeOffset.UtcNow;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EPISODES  (under a season)
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>Admin CRUD for episodes (under seasons) and video sources.</summary>
[ApiController, Authorize(Roles = "Admin"), Route("api/admin")]
public sealed class AdminEpisodeController(AppDbContext db, CatalogDocumentService catalog) : ControllerBase
{
    // ─── Episodes ─────────────────────────────────────────────────────────────

    /// <summary>Add an episode under a season (for Series-type content).</summary>
    [HttpPost("seasons/{seasonId:guid}/episodes")]
    [ProducesResponseType(typeof(EpisodeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EpisodeDto>> CreateEpisode(
        Guid seasonId, SaveEpisodeRequest r, CancellationToken ct)
    {
        if (r.Number < 1 || string.IsNullOrWhiteSpace(r.Title))
            return ValidationProblem("Episode number and title are required.");
        var season = await db.Seasons.FindAsync([seasonId], ct);
        if (season is null) return NotFound();

        var ep = new Episode
        {
            SeasonId        = seasonId,
            ContentId       = season.ContentId,
            Number          = r.Number,
            Title           = r.Title,
            ThumbnailUrl    = r.ThumbnailUrl,
            DurationSeconds = r.DurationSeconds,
            Published       = r.Published
        };
        db.Episodes.Add(ep);
        await db.SaveChangesAsync(ct);
        await catalog.SyncAsync(ep.ContentId, ct);
        return Created($"/api/admin/episodes/{ep.Id}/sources",
            new EpisodeDto(ep.Id, ep.ContentId, ep.SeasonId, ep.Number, ep.Title,
                ep.ThumbnailUrl, ep.DurationSeconds, ep.Published, []));
    }

    /// <summary>Creates one episode and one iframe video source for every non-empty URL.</summary>
    [HttpPost("seasons/{seasonId:guid}/episodes/bulk-urls")]
    public async Task<ActionResult<IReadOnlyList<EpisodeDto>>> CreateEpisodesFromUrls(
        Guid seasonId, BulkEpisodeUrlsRequest request, CancellationToken ct)
    {
        var season = await db.Seasons.FindAsync([seasonId], ct);
        if (season is null) return NotFound();

        var urls = (request.Urls ?? [])
            .Select(x => x.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (urls.Count == 0) return ValidationProblem("Provide at least one valid video URL.");
        var invalidUrl = urls.FirstOrDefault(x => !Uri.TryCreate(x, UriKind.Absolute, out _));
        if (invalidUrl is not null)
            return ValidationProblem($"Invalid video URL: {invalidUrl}");

        var nextNumber = await db.Episodes
            .Where(x => x.SeasonId == seasonId)
            .Select(x => (int?)x.Number)
            .MaxAsync(ct) ?? 0;
        var playerName = string.IsNullOrWhiteSpace(request.PlayerName) ? "Vidmoly" : request.PlayerName.Trim();
        var embedType = request.EmbedType ?? VideoEmbedType.Iframe;
        var created = new List<Episode>();

        foreach (var url in urls)
        {
            var episode = new Episode
            {
                ContentId = season.ContentId,
                SeasonId = seasonId,
                Number = ++nextNumber,
                Title = $"Episode {nextNumber}",
                DurationSeconds = 0,
                Published = true,
                VideoSources = [new VideoSource
                {
                    PlayerName = playerName,
                    Url = url,
                    EmbedType = embedType,
                    SortOrder = 0,
                    IsActive = true
                }]
            };
            created.Add(episode);
        }

        db.Episodes.AddRange(created);
        await db.SaveChangesAsync(ct);
        await catalog.SyncAsync(season.ContentId, ct);
        return Ok(created.Select(x => new EpisodeDto(x.Id, x.ContentId, x.SeasonId, x.Number, x.Title,
            x.ThumbnailUrl, x.DurationSeconds, x.Published, x.VideoSources.Select(ContentService.ToVideoSource).ToList())).ToList());
    }

    /// <summary>Update episode metadata (title, number, thumbnail, duration, published flag).</summary>
    [HttpPut("episodes/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateEpisode(Guid id, SaveEpisodeRequest r, CancellationToken ct)
    {
        if (r.Number < 1 || string.IsNullOrWhiteSpace(r.Title))
            return ValidationProblem("Episode number and title are required.");
        var ep = await db.Episodes.FindAsync([id], ct);
        if (ep is null) return NotFound();
        ep.Number          = r.Number;
        ep.Title           = r.Title;
        ep.ThumbnailUrl    = r.ThumbnailUrl;
        ep.DurationSeconds = r.DurationSeconds;
        ep.Published       = r.Published;
        await db.SaveChangesAsync(ct);
        await catalog.SyncAsync(ep.ContentId, ct);
        return NoContent();
    }

    /// <summary>Delete an episode and all its video sources.</summary>
    [HttpDelete("episodes/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteEpisode(Guid id, CancellationToken ct)
    {
        var ep = await db.Episodes.FindAsync([id], ct);
        if (ep is null) return NotFound();
        db.Episodes.Remove(ep);
        await db.SaveChangesAsync(ct);
        await catalog.SyncAsync(ep.ContentId, ct);
        return NoContent();
    }

    // ─── Video Sources ────────────────────────────────────────────────────────

    /// <summary>
    /// List all video sources for an episode, ordered by SortOrder.
    /// Includes inactive sources so the admin can see and re-enable them.
    /// </summary>
    [HttpGet("episodes/{episodeId:guid}/sources")]
    [ProducesResponseType(typeof(IReadOnlyList<AdminVideoSourceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<AdminVideoSourceDto>>> ListSources(
        Guid episodeId, CancellationToken ct)
    {
        if (!await db.Episodes.AnyAsync(x => x.Id == episodeId, ct)) return NotFound();

        var sources = await db.VideoSources.AsNoTracking()
            .Where(x => x.EpisodeId == episodeId)
            .OrderBy(x => x.SortOrder)
            .Select(x => new AdminVideoSourceDto(x.Id, x.EpisodeId, x.PlayerName, x.Url, x.EmbedType, x.Quality, x.SortOrder, x.IsActive))
            .ToListAsync(ct);

        return Ok(sources);
    }

    /// <summary>Add a new video source to an episode.</summary>
    [HttpPost("episodes/{episodeId:guid}/sources")]
    [ProducesResponseType(typeof(AdminVideoSourceDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AdminVideoSourceDto>> CreateSource(
        Guid episodeId, SaveVideoSourceRequest r, CancellationToken ct)
    {
        if (!Uri.TryCreate(r.Url?.Trim(), UriKind.Absolute, out _))
            return ValidationProblem("A valid absolute video URL is required.");
        if (!await db.Episodes.AnyAsync(x => x.Id == episodeId, ct)) return NotFound();

        var src = new VideoSource
        {
            EpisodeId  = episodeId,
            PlayerName = r.PlayerName,
            Url        = r.Url,
            EmbedType  = r.EmbedType,
            Quality    = r.Quality,
            SortOrder  = r.SortOrder,
            IsActive   = r.IsActive
        };
        db.VideoSources.Add(src);
        await db.SaveChangesAsync(ct);
        var contentId = await db.Episodes.Where(x => x.Id == episodeId).Select(x => x.ContentId).SingleAsync(ct);
        await catalog.SyncAsync(contentId, ct);

        var dto = new AdminVideoSourceDto(src.Id, src.EpisodeId, src.PlayerName, src.Url, src.EmbedType, src.Quality, src.SortOrder, src.IsActive);
        return Created($"/api/admin/sources/{src.Id}", dto);
    }

    /// <summary>Update a video source (URL, player name, quality, sort order, active toggle).</summary>
    [HttpPut("sources/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateSource(Guid id, SaveVideoSourceRequest r, CancellationToken ct)
    {
        if (!Uri.TryCreate(r.Url?.Trim(), UriKind.Absolute, out _))
            return ValidationProblem("A valid absolute video URL is required.");
        var src = await db.VideoSources.FindAsync([id], ct);
        if (src is null) return NotFound();
        src.PlayerName = r.PlayerName;
        src.Url        = r.Url;
        src.EmbedType  = r.EmbedType;
        src.Quality    = r.Quality;
        src.SortOrder  = r.SortOrder;
        src.IsActive   = r.IsActive;
        await db.SaveChangesAsync(ct);
        var contentId = await db.Episodes.Where(x => x.Id == src.EpisodeId).Select(x => x.ContentId).SingleAsync(ct);
        await catalog.SyncAsync(contentId, ct);
        return NoContent();
    }

    /// <summary>Delete a video source row.</summary>
    [HttpDelete("sources/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteSource(Guid id, CancellationToken ct)
    {
        var src = await db.VideoSources.FindAsync([id], ct);
        if (src is null) return NotFound();
        db.VideoSources.Remove(src);
        await db.SaveChangesAsync(ct);
        var contentId = await db.Episodes.Where(x => x.Id == src.EpisodeId).Select(x => x.ContentId).SingleAsync(ct);
        await catalog.SyncAsync(contentId, ct);
        return NoContent();
    }

    /// <summary>
    /// Reorder video sources for an episode by providing the desired source IDs in order.
    /// SortOrder values are reassigned as 0, 1, 2 … per the supplied list.
    /// </summary>
    [HttpPut("episodes/{episodeId:guid}/sources/reorder")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReorderSources(
        Guid episodeId, ReorderSourcesRequest r, CancellationToken ct)
    {
        if (!await db.Episodes.AnyAsync(x => x.Id == episodeId, ct)) return NotFound();

        var sources = await db.VideoSources
            .Where(x => x.EpisodeId == episodeId)
            .ToListAsync(ct);

        if (r.OrderedSourceIds.Count != sources.Count)
            return ValidationProblem("OrderedSourceIds must contain every source ID for this episode (no additions or omissions).");

        var lookup = sources.ToDictionary(x => x.Id);
        for (var i = 0; i < r.OrderedSourceIds.Count; i++)
        {
            if (!lookup.TryGetValue(r.OrderedSourceIds[i], out var src))
                return ValidationProblem($"Source ID {r.OrderedSourceIds[i]} does not belong to episode {episodeId}.");
            src.SortOrder = i;
        }

        await db.SaveChangesAsync(ct);
        var contentId = await db.Episodes.Where(x => x.Id == episodeId).Select(x => x.ContentId).SingleAsync(ct);
        await catalog.SyncAsync(contentId, ct);
        return NoContent();
    }

}

// ─── Admin-only DTO ───────────────────────────────────────────────────────────

/// <summary>Video source DTO for admin responses — includes IsActive so inactive sources are visible.</summary>
public sealed record AdminVideoSourceDto(
    Guid Id, Guid EpisodeId, string PlayerName, string Url, VideoEmbedType EmbedType,
    string? Quality, int SortOrder, bool IsActive);
