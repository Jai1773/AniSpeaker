using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using ToonSpeaker.Api.Domain;

namespace ToonSpeaker.Api.Infrastructure.Services;

public sealed class JwtOptions
{
    public string Issuer { get; init; } = "AniSpeaker";
    public string Audience { get; init; } = "AniSpeaker.Web";
    public string Secret { get; init; } = string.Empty;
    public int AccessTokenMinutes { get; init; } = 15;
    public int RefreshTokenDays { get; init; } = 14;
}

public sealed class TokenService(JwtOptions options)
{
    public (string Token, DateTimeOffset ExpiresAt) CreateAccessToken(AppUser user)
    {
        var expiry = DateTimeOffset.UtcNow.AddMinutes(options.AccessTokenMinutes);
        var claims = new[] { new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()), new Claim(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty), new Claim(ClaimTypes.Role, user.Role), new Claim("display_name", user.DisplayName) };
        var credentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Secret)), SecurityAlgorithms.HmacSha256);
        return (new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(options.Issuer, options.Audience, claims, expires: expiry.UtcDateTime, signingCredentials: credentials)), expiry);
    }
    public string CreateRefreshToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
    public string HashRefreshToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    public DateTimeOffset RefreshExpiry() => DateTimeOffset.UtcNow.AddDays(options.RefreshTokenDays);
}
