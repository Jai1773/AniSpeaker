using Microsoft.AspNetCore.Identity;

namespace ToonSpeaker.Api.Domain;

public enum ContentType { Series, Movie }

public sealed class Category
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public ICollection<Content> Content { get; set; } = new List<Content>();
}

public sealed class Content
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CategoryId { get; set; }
    public Category Category { get; set; } = null!;
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public ContentType Type { get; set; }
    public string? Description { get; set; }
    public string? PosterUrl { get; set; }
    public string? BannerUrl { get; set; }
    public string[] Tags { get; set; } = [];
    public bool Published { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public ICollection<Season> Seasons { get; set; } = new List<Season>();
    public ICollection<Episode> Episodes { get; set; } = new List<Episode>();
}

public sealed class Season
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ContentId { get; set; }
    public Content Content { get; set; } = null!;
    public int Number { get; set; }
    public string Title { get; set; } = string.Empty;
    public ICollection<Episode> Episodes { get; set; } = new List<Episode>();
}

public sealed class Episode
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ContentId { get; set; }
    public Content Content { get; set; } = null!;
    public Guid? SeasonId { get; set; }
    public Season? Season { get; set; }
    public int Number { get; set; }
    public string Title { get; set; } = string.Empty;
    public string VideoKey { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public int DurationSeconds { get; set; }
    public bool Published { get; set; }
}

public sealed class AppUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = string.Empty;
    public string Role { get; set; } = "User";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}

public sealed class RefreshToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public string TokenHash { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}

public sealed class WatchHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public Guid EpisodeId { get; set; }
    public Episode Episode { get; set; } = null!;
    public int ProgressSeconds { get; set; }
    public DateTimeOffset LastWatchedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class WatchLater
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public Guid ContentId { get; set; }
    public Content Content { get; set; } = null!;
    public DateTimeOffset AddedAt { get; set; } = DateTimeOffset.UtcNow;
}
