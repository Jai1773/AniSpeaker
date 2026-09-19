using Microsoft.AspNetCore.Mvc;
using ToonSpeaker.Api.Application;
using ToonSpeaker.Api.Domain;

namespace ToonSpeaker.Api.Controllers;

[ApiController]
[Route("api/content")]
public sealed class ContentController(IContentService content) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PageResult<ContentSummaryDto>), StatusCodes.Status200OK)]
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

    [HttpGet("{slug}")]
    [ProducesResponseType(typeof(ContentDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ContentDetailDto>> GetBySlug(string slug, CancellationToken cancellationToken)
    {
        var result = await content.GetBySlugAsync(slug, false, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }
}
