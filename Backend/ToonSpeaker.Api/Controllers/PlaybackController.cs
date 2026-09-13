using Microsoft.AspNetCore.Mvc;
using ToonSpeaker.Api.Application;

namespace ToonSpeaker.Api.Controllers;

[ApiController]
[Route("api/playback")]
public sealed class PlaybackController(IContentService content) : ControllerBase
{
    [HttpGet("{episodeId:guid}")]
    [ProducesResponseType(typeof(PlaybackDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PlaybackDto>> Get(Guid episodeId, CancellationToken cancellationToken)
    {
        var playback = await content.GetPlaybackAsync(episodeId, cancellationToken);
        return playback is null ? NotFound() : Ok(playback);
    }
}
