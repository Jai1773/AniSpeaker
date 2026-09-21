using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ToonSpeaker.Api.Application;
using ToonSpeaker.Api.Domain;
using ToonSpeaker.Api.Infrastructure.Persistence;
using ToonSpeaker.Api.Infrastructure.Services;

namespace ToonSpeaker.Api.Controllers;

[ApiController, Route("api/auth")]
public sealed class AuthController(UserManager<AppUser> users, AppDbContext db, TokenService tokens) : ControllerBase
{
    [HttpPost("register")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var user = new AppUser { UserName = request.Email, Email = request.Email, DisplayName = request.DisplayName };
        var result = await users.CreateAsync(user, request.Password);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors.Select(x => new { x.Code, x.Description }) });
        var response = await IssueTokensAsync(user, ct);
        await transaction.CommitAsync(ct);
        return response;
    }

    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(request.Email);
        if (user is null || !await users.CheckPasswordAsync(user, request.Password))
            return Unauthorized();
        return await IssueTokensAsync(user, ct);
    }

    [HttpPost("refresh")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Refresh(CancellationToken ct)
    {
        if (!Request.Cookies.TryGetValue("refresh_token", out var raw)) return Unauthorized();
        var saved = await db.RefreshTokens.Include(x => x.User)
            .SingleOrDefaultAsync(x => x.TokenHash == tokens.HashRefreshToken(raw)
                && x.RevokedAt == null && x.ExpiresAt > DateTimeOffset.UtcNow, ct);
        if (saved is null) return Unauthorized();
        saved.RevokedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return await IssueTokensAsync(saved.User, ct);
    }

    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        if (Request.Cookies.TryGetValue("refresh_token", out var raw))
        {
            var saved = await db.RefreshTokens.SingleOrDefaultAsync(x => x.TokenHash == tokens.HashRefreshToken(raw), ct);
            if (saved is not null) { saved.RevokedAt = DateTimeOffset.UtcNow; await db.SaveChangesAsync(ct); }
        }
        Response.Cookies.Delete("refresh_token");
        return NoContent();
    }

    private async Task<ActionResult<AuthResponse>> IssueTokensAsync(AppUser user, CancellationToken ct)
    {
        var (access, exp) = tokens.CreateAccessToken(user);
        var raw = tokens.CreateRefreshToken();
        var refreshExpiry = tokens.RefreshExpiry();
        db.RefreshTokens.Add(new RefreshToken { UserId = user.Id, TokenHash = tokens.HashRefreshToken(raw), ExpiresAt = refreshExpiry });
        await db.SaveChangesAsync(ct);
        // ForwardedHeaders middleware makes Request.IsHttps correct behind Render/Cloudflare edge.
        // SameSite=None: required for cross-origin cookie (Angular on .pages.dev -> API on .onrender.com).
        Response.Cookies.Append("refresh_token", raw, new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = Request.IsHttps ? SameSiteMode.None : SameSiteMode.Lax,
            Expires = refreshExpiry
        });
        return Ok(new AuthResponse(access, exp, user.Email!, user.DisplayName, user.Role));
    }
}
