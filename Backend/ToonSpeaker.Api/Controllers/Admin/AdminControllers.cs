using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ToonSpeaker.Api.Application;
using ToonSpeaker.Api.Domain;
using ToonSpeaker.Api.Infrastructure.Persistence;
using ToonSpeaker.Api.Infrastructure.Services;

namespace ToonSpeaker.Api.Controllers.Admin;

[ApiController, Authorize(Roles = "Admin"), Route("api/admin/categories")]
public sealed class AdminCategoryController(AppDbContext db) : ControllerBase
{
    [HttpGet] public async Task<ActionResult<IReadOnlyList<CategoryDto>>> List(CancellationToken ct) => Ok(await db.Categories.AsNoTracking().OrderBy(x => x.SortOrder).Select(x => new CategoryDto(x.Id, x.Name, x.Slug, x.SortOrder)).ToListAsync(ct));
    [HttpPost] public async Task<ActionResult<CategoryDto>> Create(CreateCategoryRequest r, CancellationToken ct) { var x = new Category { Name = r.Name, Slug = r.Slug, SortOrder = r.SortOrder }; db.Categories.Add(x); await db.SaveChangesAsync(ct); return CreatedAtAction(nameof(List), new CategoryDto(x.Id, x.Name, x.Slug, x.SortOrder)); }
    [HttpPut("{id:guid}")] public async Task<IActionResult> Update(Guid id, UpdateCategoryRequest r, CancellationToken ct) { var x = await db.Categories.FindAsync([id], ct); if (x is null) return NotFound(); x.Name = r.Name; x.Slug = r.Slug; x.SortOrder = r.SortOrder; await db.SaveChangesAsync(ct); return NoContent(); }
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { var x = await db.Categories.FindAsync([id], ct); if (x is null) return NotFound(); db.Categories.Remove(x); await db.SaveChangesAsync(ct); return NoContent(); }
}

[ApiController, Authorize(Roles = "Admin"), Route("api/admin/content")]
public sealed class AdminContentController(AppDbContext db, IContentService content) : ControllerBase
{
    [HttpGet] public Task<ActionResult<PageResult<ContentSummaryDto>>> List([FromQuery] string? search, [FromQuery] Guid? category, [FromQuery] ContentType? type, [FromQuery] int page = 1, [FromQuery] int pageSize = 24, CancellationToken ct = default) => ListCore(category, type, page, pageSize, ct);
    private async Task<ActionResult<PageResult<ContentSummaryDto>>> ListCore(Guid? category, ContentType? type, int page, int pageSize, CancellationToken ct) => Ok(await content.BrowseAsync(category, type, page, pageSize, true, ct));
    [HttpPost] public async Task<ActionResult<ContentSummaryDto>> Create(SaveContentRequest r, CancellationToken ct) { if (!await db.Categories.AnyAsync(x => x.Id == r.CategoryId, ct)) return ValidationProblem("Category does not exist."); var x = NewContent(r); db.Content.Add(x); await db.SaveChangesAsync(ct); return Created($"/api/admin/content/{x.Id}", ContentService.ToSummary(x)); }
    [HttpPut("{id:guid}")] public async Task<IActionResult> Update(Guid id, SaveContentRequest r, CancellationToken ct) { var x = await db.Content.FindAsync([id], ct); if (x is null) return NotFound(); Apply(x, r); await db.SaveChangesAsync(ct); return NoContent(); }
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { var x = await db.Content.FindAsync([id], ct); if (x is null) return NotFound(); db.Content.Remove(x); await db.SaveChangesAsync(ct); return NoContent(); }
    [HttpPost("{contentId:guid}/seasons")] public async Task<ActionResult<SeasonDto>> Season(Guid contentId, CreateSeasonRequest r, CancellationToken ct) { if (!await db.Content.AnyAsync(x => x.Id == contentId, ct)) return NotFound(); var x = new Season { ContentId = contentId, Number = r.Number, Title = r.Title }; db.Seasons.Add(x); await db.SaveChangesAsync(ct); return Ok(new SeasonDto(x.Id, x.Number, x.Title, [])); }
    private static Content NewContent(SaveContentRequest r) { var x = new Content(); Apply(x, r); return x; }
    private static void Apply(Content x, SaveContentRequest r) { x.CategoryId = r.CategoryId; x.Title = r.Title; x.Slug = r.Slug; x.Type = r.Type; x.Description = r.Description; x.PosterUrl = r.PosterUrl; x.BannerUrl = r.BannerUrl; x.Tags = r.Tags ?? []; x.Published = r.Published; x.UpdatedAt = DateTimeOffset.UtcNow; }
}

[ApiController, Authorize(Roles = "Admin"), Route("api/admin")]
public sealed class AdminEpisodeUploadController(AppDbContext db, IStorageService storage) : ControllerBase
{
    [HttpPost("seasons/{seasonId:guid}/episodes")] public async Task<ActionResult<EpisodeDto>> CreateEpisode(Guid seasonId, SaveEpisodeRequest r, CancellationToken ct) { var season = await db.Seasons.FindAsync([seasonId], ct); if (season is null) return NotFound(); var x = new Episode { SeasonId = seasonId, ContentId = season.ContentId, Number = r.Number, Title = r.Title, VideoKey = r.VideoKey, ThumbnailUrl = r.ThumbnailUrl, DurationSeconds = r.DurationSeconds, Published = r.Published }; db.Episodes.Add(x); await db.SaveChangesAsync(ct); return Ok(ContentService.ToEpisode(x)); }
    [HttpPut("episodes/{id:guid}")] public async Task<IActionResult> UpdateEpisode(Guid id, SaveEpisodeRequest r, CancellationToken ct) { var x = await db.Episodes.FindAsync([id], ct); if (x is null) return NotFound(); x.Number = r.Number; x.Title = r.Title; x.VideoKey = r.VideoKey; x.ThumbnailUrl = r.ThumbnailUrl; x.DurationSeconds = r.DurationSeconds; x.Published = r.Published; await db.SaveChangesAsync(ct); return NoContent(); }
    [HttpDelete("episodes/{id:guid}")] public async Task<IActionResult> DeleteEpisode(Guid id, CancellationToken ct) { var x = await db.Episodes.FindAsync([id], ct); if (x is null) return NotFound(); db.Episodes.Remove(x); await db.SaveChangesAsync(ct); return NoContent(); }
    [HttpPost("uploads/init")] public Task<UploadInitResponse> InitUpload(UploadInitRequest request, CancellationToken ct) => storage.CreateUploadAsync(request, ct);
}
