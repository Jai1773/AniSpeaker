using Microsoft.AspNetCore.Identity;
using System.Text.Json;

namespace ToonSpeaker.Api.Domain;

public enum ContentType { Series, Movie }
public enum VideoEmbedType { Iframe, Direct }

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
    /// <summary>JSONB catalog document containing the content, seasons, episodes, and video URL list.</summary>
    public JsonDocument? CatalogJson { get; set; }
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
    public string? ThumbnailUrl { get; set; }
    public int DurationSeconds { get; set; }
    public bool Published { get; set; }
    /// <summary>Navigation: multiple video sources for this episode (different players/mirrors).</summary>
    public ICollection<VideoSource> VideoSources { get; set; } = new List<VideoSource>();
}

/// <summary>
/// A single playable source for an episode (e.g. Vidmoly embed, StreamTape, direct R2 MP4).
/// Episodes can have multiple sources; the player tries them in <see cref="SortOrder"/> order.
/// </summary>
public sealed class VideoSource
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EpisodeId { get; set; }
    public Episode Episode { get; set; } = null!;
    /// <summary>Human-readable player/host name, e.g. "Vidmoly", "StreamTape", "Direct MP4".</summary>
    public string PlayerName { get; set; } = string.Empty;
    /// <summary>Embed URL or direct file URL for this source.</summary>
    public string Url { get; set; } = string.Empty;
    /// <summary>Controls whether the frontend renders this source in an iframe or HTML5 video element.</summary>
    public VideoEmbedType EmbedType { get; set; } = VideoEmbedType.Iframe;
    /// <summary>Optional quality label, e.g. "1080p", "720p".</summary>
    public string? Quality { get; set; }
    /// <summary>Ascending playback order; lower number plays first.</summary>
    public int SortOrder { get; set; }
    /// <summary>When false the source is skipped by the player (dead link toggle without deleting).</summary>
    public bool IsActive { get; set; } = true;
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
