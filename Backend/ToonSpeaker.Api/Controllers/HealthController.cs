using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ToonSpeaker.Api.Infrastructure.Persistence;

namespace ToonSpeaker.Api.Controllers;

[ApiController]
[Route("health")]
public sealed class HealthController(AppDbContext db, ILogger<HealthController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        try
        {
            if (await db.Database.CanConnectAsync(ct))
                return Ok(new { status = "healthy" });
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Health check could not connect to the database.");
        }

        return Problem(
            statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "Database unavailable");
    }
}
