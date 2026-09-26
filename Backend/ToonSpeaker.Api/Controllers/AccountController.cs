using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ToonSpeaker.Api.Application;
using ToonSpeaker.Api.Domain;
using ToonSpeaker.Api.Infrastructure.Persistence;
using ToonSpeaker.Api.Infrastructure.Services;

namespace ToonSpeaker.Api.Controllers;

/// <summary>Authenticated user account endpoints — watch history and watch later list.</summary>
[ApiController, Authorize, Route("api/account")]
public sealed class AccountController(AppDbContext db) : ControllerBase
{
    // Reads the "sub" claim written by TokenService.CreateAccessToken().
    // Tries both the ASP.NET-mapped key and the raw JWT key for safety.
    private Guid UserId
    {
        get
        {
            var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            if (raw is null || !Guid.TryParse(raw, out var id))
                throw new InvalidOperationException("Authenticated user has no valid sub claim.");
            return id;
        }
    }

    // ─── Watch History ────────────────────────────────────────────────────────

    /// <summary>
    /// Get the authenticated user's "Continue Watching" list.
    /// Returns episodes that are less than 95 % complete, ordered by most recently watched.
    /// </summary>
    [HttpGet("history")]
    [ProducesResponseType(typeof(IReadOnlyList<HistoryItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<HistoryItemDto>>> History(CancellationToken ct)
    {
        var uid = UserId;

        // Cast DurationSeconds to double before multiplying to avoid integer arithmetic issues in SQL.
        var items = await db.WatchHistory.AsNoTracking()
            .Where(x => x.UserId == uid &&
                        x.ProgressSeconds < (double)x.Episode.DurationSeconds * 0.95)
            .Include(x => x.Episode).ThenInclude(e => e.VideoSources)
            .Include(x => x.Episode).ThenInclude(e => e.Content)
            .OrderByDescending(x => x.LastWatchedAt)
            .Take(50)
            .Select(x => new HistoryItemDto(
                ContentService.ToEpisode(x.Episode),
                ContentService.ToSummary(x.Episode.Content),
                x.ProgressSeconds,
                x.LastWatchedAt))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Upsert watch progress for an episode.
    /// If a history row already exists for this user+episode it is updated; otherwise a new row is created.
    /// </summary>
    [HttpPost("history")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SaveHistory(SaveHistoryRequest request, CancellationToken ct)
    {
        var episode = await db.Episodes.FindAsync([request.EpisodeId], ct);
        if (episode is null || request.ProgressSeconds < 0)
            return ValidationProblem("Invalid episode or progress.");

        var uid  = UserId;
        var item = await db.WatchHistory.SingleOrDefaultAsync(
            x => x.UserId == uid && x.EpisodeId == request.EpisodeId, ct);

        if (item is null)
            db.WatchHistory.Add(new WatchHistory
            {
                UserId          = uid,
                EpisodeId       = request.EpisodeId,
                ProgressSeconds = request.ProgressSeconds
            });
        else
        {
            item.ProgressSeconds = request.ProgressSeconds;
            item.LastWatchedAt   = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ─── Watch Later ──────────────────────────────────────────────────────────

    /// <summary>Get the authenticated user's Watch Later list, ordered by most recently added.</summary>
    [HttpGet("watch-later")]
    [ProducesResponseType(typeof(IReadOnlyList<ContentSummaryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ContentSummaryDto>>> WatchLater(CancellationToken ct)
    {
        var uid = UserId;
        return Ok(await db.WatchLater.AsNoTracking()
            .Where(x => x.UserId == uid && x.Content != null && x.Content.Published)
            .Include(x => x.Content)
            .OrderByDescending(x => x.AddedAt)
            .Select(x => ContentService.ToSummary(x.Content))
            .ToListAsync(ct));
    }

    /// <summary>Add content to the authenticated user's Watch Later list (idempotent).</summary>
    [HttpPost("watch-later")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddWatchLater([FromBody] System.Text.Json.JsonElement body, CancellationToken ct)
    {
        Guid contentId;
        if (body.ValueKind == System.Text.Json.JsonValueKind.String)
        {
            if (!Guid.TryParse(body.GetString(), out contentId)) return BadRequest();
        }
        else if (body.ValueKind == System.Text.Json.JsonValueKind.Object &&
                 (body.TryGetProperty("contentId", out var prop) || body.TryGetProperty("ContentId", out prop)))
        {
            if (!Guid.TryParse(prop.GetString(), out contentId)) return BadRequest();
        }
        else
        {
            return BadRequest();
        }

        if (!await db.Content.AnyAsync(x => x.Id == contentId && x.Published, ct)) return NotFound();

        var uid = UserId;
        if (!await db.WatchLater.AnyAsync(x => x.UserId == uid && x.ContentId == contentId, ct))
        {
            db.WatchLater.Add(new WatchLater { UserId = uid, ContentId = contentId });
            await db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    /// <summary>Remove content from the authenticated user's Watch Later list.</summary>
    [HttpDelete("watch-later/{contentId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RemoveWatchLater(Guid contentId, CancellationToken ct)
    {
        var uid  = UserId;
        var item = await db.WatchLater.SingleOrDefaultAsync(
            x => x.UserId == uid && x.ContentId == contentId, ct);

        if (item is not null)
        {
            db.WatchLater.Remove(item);
            await db.SaveChangesAsync(ct);
        }
        return NoContent();
    }
}
