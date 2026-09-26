using Microsoft.AspNetCore.Mvc;
using ToonSpeaker.Api.Application;

namespace ToonSpeaker.Api.Controllers;

/// <summary>Returns active video sources for an episode, ordered by playback priority.</summary>
[ApiController]
[Route("api/playback")]
public sealed class PlaybackController(IContentService content) : ControllerBase
{
    /// <summary>
    /// Get the ordered list of active video sources for an episode.
    /// The player should try sources in order and fall back to the next if one fails.
    /// </summary>
    /// <param name="episodeId">The episode GUID.</param>
    /// <param name="cancellationToken"></param>
    [HttpGet("{episodeId:guid}")]
    [ProducesResponseType(typeof(PlaybackSourcesDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PlaybackSourcesDto>> Get(Guid episodeId, CancellationToken cancellationToken)
    {
        var result = await content.GetPlaybackAsync(episodeId, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }
}
