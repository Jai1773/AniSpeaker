using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ToonSpeaker.Api.Application;
using ToonSpeaker.Api.Domain;
using ToonSpeaker.Api.Infrastructure.Persistence;
using ToonSpeaker.Api.Infrastructure.Services;

namespace ToonSpeaker.Api.Controllers;
[ApiController, Authorize, Route("api/account")]
public sealed class AccountController(AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
    [HttpGet("history")] public async Task<ActionResult<IReadOnlyList<HistoryItemDto>>> History(CancellationToken ct) => Ok(await db.WatchHistory.AsNoTracking().Where(x => x.UserId == UserId && x.ProgressSeconds < x.Episode.DurationSeconds * .95).Include(x => x.Episode).ThenInclude(x => x.Content).OrderByDescending(x => x.LastWatchedAt).Take(50).Select(x => new HistoryItemDto(ContentService.ToEpisode(x.Episode), ContentService.ToSummary(x.Episode.Content), x.ProgressSeconds, x.LastWatchedAt)).ToListAsync(ct));
    [HttpPost("history")] public async Task<IActionResult> SaveHistory(SaveHistoryRequest request, CancellationToken ct) { var episode = await db.Episodes.FindAsync([request.EpisodeId], ct); if (episode is null || request.ProgressSeconds < 0) return ValidationProblem("Invalid episode or progress."); var item = await db.WatchHistory.SingleOrDefaultAsync(x => x.UserId == UserId && x.EpisodeId == request.EpisodeId, ct); if (item is null) db.WatchHistory.Add(new WatchHistory { UserId = UserId, EpisodeId = request.EpisodeId, ProgressSeconds = request.ProgressSeconds }); else { item.ProgressSeconds = request.ProgressSeconds; item.LastWatchedAt = DateTimeOffset.UtcNow; } await db.SaveChangesAsync(ct); return NoContent(); }
    [HttpGet("watch-later")] public async Task<ActionResult<IReadOnlyList<ContentSummaryDto>>> WatchLater(CancellationToken ct) => Ok(await db.WatchLater.AsNoTracking().Where(x => x.UserId == UserId).Include(x => x.Content).OrderByDescending(x => x.AddedAt).Select(x => ContentService.ToSummary(x.Content)).ToListAsync(ct));
    [HttpPost("watch-later")] public async Task<IActionResult> AddWatchLater([FromBody] Guid contentId, CancellationToken ct) { if (!await db.Content.AnyAsync(x => x.Id == contentId && x.Published, ct)) return NotFound(); if (!await db.WatchLater.AnyAsync(x => x.UserId == UserId && x.ContentId == contentId, ct)) { db.WatchLater.Add(new WatchLater { UserId = UserId, ContentId = contentId }); await db.SaveChangesAsync(ct); } return NoContent(); }
    [HttpDelete("watch-later/{contentId:guid}")] public async Task<IActionResult> RemoveWatchLater(Guid contentId, CancellationToken ct) { var item = await db.WatchLater.SingleOrDefaultAsync(x => x.UserId == UserId && x.ContentId == contentId, ct); if (item is not null) { db.WatchLater.Remove(item); await db.SaveChangesAsync(ct); } return NoContent(); }
}
