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
    [HttpPost("register")] public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken ct) { var user = new AppUser { UserName = request.Email, Email = request.Email, DisplayName = request.DisplayName }; var result = await users.CreateAsync(user, request.Password); return !result.Succeeded ? BadRequest(new { errors = result.Errors.Select(x => new { x.Code, x.Description }) }) : await Issue(user, ct); }
    [HttpPost("login")] public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken ct) { var user = await users.FindByEmailAsync(request.Email); return user is null || !await users.CheckPasswordAsync(user, request.Password) ? Unauthorized() : await Issue(user, ct); }
    [HttpPost("refresh")] public async Task<ActionResult<AuthResponse>> Refresh(CancellationToken ct) { if (!Request.Cookies.TryGetValue("refresh_token", out var raw)) return Unauthorized(); var saved = await db.RefreshTokens.Include(x => x.User).SingleOrDefaultAsync(x => x.TokenHash == tokens.HashRefreshToken(raw) && x.RevokedAt == null && x.ExpiresAt > DateTimeOffset.UtcNow, ct); if (saved is null) return Unauthorized(); saved.RevokedAt = DateTimeOffset.UtcNow; await db.SaveChangesAsync(ct); return await Issue(saved.User, ct); }
    private async Task<ActionResult<AuthResponse>> Issue(AppUser user, CancellationToken ct) { var (access, exp) = tokens.CreateAccessToken(user); var raw = tokens.CreateRefreshToken(); var refreshExpiry = tokens.RefreshExpiry(); db.RefreshTokens.Add(new RefreshToken { UserId = user.Id, TokenHash = tokens.HashRefreshToken(raw), ExpiresAt = refreshExpiry }); await db.SaveChangesAsync(ct); Response.Cookies.Append("refresh_token", raw, new CookieOptions { HttpOnly = true, Secure = Request.IsHttps, SameSite = SameSiteMode.Lax, Expires = refreshExpiry }); return Ok(new AuthResponse(access, exp, user.Email!, user.DisplayName, user.Role)); }
}
