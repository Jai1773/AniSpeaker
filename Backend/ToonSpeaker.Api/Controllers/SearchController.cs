using Microsoft.AspNetCore.Mvc;
using ToonSpeaker.Api.Application;

namespace ToonSpeaker.Api.Controllers;

[ApiController]
[Route("api/search")]
public sealed class SearchController(IContentService content) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ContentSummaryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ContentSummaryDto>>> Search([FromQuery] string q, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(q))
            return ValidationProblem("q is required.");

        return Ok(await content.SearchAsync(q.Trim(), cancellationToken));
    }
}
