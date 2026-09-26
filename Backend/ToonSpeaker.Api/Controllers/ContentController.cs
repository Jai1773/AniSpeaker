using Microsoft.AspNetCore.Mvc;
using ToonSpeaker.Api.Application;
using ToonSpeaker.Api.Domain;

namespace ToonSpeaker.Api.Controllers;

/// <summary>Public content browsing endpoints — no authentication required.</summary>
[ApiController]
[Route("api/content")]
public sealed class ContentController(IContentService content) : ControllerBase
{
    /// <summary>
    /// Browse published content with optional filtering by category, type, and pagination.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PageResult<ContentSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PageResult<ContentSummaryDto>>> Browse(
        [FromQuery] Guid? category,
        [FromQuery] ContentType? type,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 24,
        CancellationToken cancellationToken = default)
    {
        if (page < 1 || pageSize is < 1 or > 100)
            return ValidationProblem("page must be at least 1 and pageSize must be between 1 and 100.");

        return Ok(await content.BrowseAsync(category, type, page, pageSize, false, cancellationToken));
    }

    /// <summary>
    /// Get full content detail by slug, including seasons, episodes, and video sources.
    /// </summary>
    /// <param name="slug">URL-friendly slug, e.g. "one-piece".</param>
    /// <param name="cancellationToken"></param>
    /// <summary>
    /// Get full content detail by slug, including seasons, episodes, related content, and user status.
    /// </summary>
    /// <param name="slug">URL-friendly slug, e.g. "one-piece".</param>
    /// <param name="userId">Optional user ID to check watch-later status.</param>
    /// <param name="cancellationToken"></param>
    [HttpGet("{slug}/composite")]
    [ProducesResponseType(typeof(CompositeDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CompositeDetailDto>> GetComposite(
        string slug,
        [FromQuery] Guid? userId,
        CancellationToken cancellationToken)
    {
        var result = await content.GetCompositeDetailAsync(slug, userId, false, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("{slug}")]
    [ProducesResponseType(typeof(ContentDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ContentDetailDto>> GetBySlug(string slug, CancellationToken cancellationToken)
    {
        var result = await content.GetBySlugAsync(slug, false, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }
}
