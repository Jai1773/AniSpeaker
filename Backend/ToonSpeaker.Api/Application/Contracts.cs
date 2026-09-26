using ToonSpeaker.Api.Domain;

namespace ToonSpeaker.Api.Application;

// ─── Public read DTOs ────────────────────────────────────────────────────────

public sealed record CategoryDto(Guid Id, string Name, string Slug, int SortOrder);

public sealed record ContentSummaryDto(
    Guid Id, Guid CategoryId, string Title, string Slug, ContentType Type,
    string? Description, string? PosterUrl, string? BannerUrl,
    IReadOnlyList<string> Tags, bool Published);

/// <summary>A single playable video source for an episode.</summary>
public sealed record VideoSourceDto(
    Guid Id, string PlayerName, string Url, VideoEmbedType EmbedType, string? Quality, int SortOrder);

public sealed record EpisodeDto(
    Guid Id, Guid ContentId, Guid? SeasonId, int Number, string Title,
    string? ThumbnailUrl, int DurationSeconds, bool Published,
    IReadOnlyList<VideoSourceDto> VideoSources);

public sealed record SeasonDto(Guid Id, int Number, string Title, IReadOnlyList<EpisodeDto> Episodes);

public sealed record ContentDetailDto(
    Guid Id, Guid CategoryId, string Title, string Slug, ContentType Type,
    string? Description, string? PosterUrl, string? BannerUrl,
    IReadOnlyList<string> Tags, bool Published,
    IReadOnlyList<SeasonDto> Seasons,
    IReadOnlyList<EpisodeDto> Episodes);

public sealed record CompositeDetailDto(
    ContentDetailDto Detail,
    IReadOnlyList<ContentSummaryDto> Related,
    bool IsSaved);

public sealed record PlaybackSourcesDto(Guid EpisodeId, IReadOnlyList<VideoSourceDto> Sources);

public sealed record PageResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);

// ─── Account DTOs ─────────────────────────────────────────────────────────────

public sealed record HistoryItemDto(EpisodeDto Episode, ContentSummaryDto Content, int ProgressSeconds, DateTimeOffset LastWatchedAt);

// ─── Auth DTOs ────────────────────────────────────────────────────────────────

public sealed record RegisterRequest(string Email, string Password, string DisplayName);
public sealed record LoginRequest(string Email, string Password);
public sealed record AuthResponse(string AccessToken, DateTimeOffset AccessTokenExpiresAt, string Email, string DisplayName, string Role);
public sealed record SaveHistoryRequest(Guid EpisodeId, int ProgressSeconds);

// ─── Admin request records ────────────────────────────────────────────────────

public sealed record CreateCategoryRequest(string Name, string Slug, int SortOrder);
public sealed record UpdateCategoryRequest(string Name, string Slug, int SortOrder);

public sealed record SaveContentRequest(
    Guid CategoryId, string Title, string Slug, ContentType Type,
    string? Description, string? PosterUrl, string? BannerUrl,
    string[]? Tags, bool Published);

public sealed record CreateSeasonRequest(int Number, string Title);

public sealed record SaveEpisodeRequest(
    int Number, string Title, string? ThumbnailUrl, int DurationSeconds, bool Published);

public sealed record SaveVideoSourceRequest(
    string PlayerName, string Url, VideoEmbedType EmbedType, string? Quality, int SortOrder, bool IsActive);

public sealed record ReorderSourcesRequest(IReadOnlyList<Guid> OrderedSourceIds);
public sealed record BulkEpisodeUrlsRequest(IReadOnlyList<string> Urls, string? PlayerName, VideoEmbedType? EmbedType);

// ─── Service interfaces ───────────────────────────────────────────────────────

public interface IContentService
{
    Task<PageResult<ContentSummaryDto>> BrowseAsync(Guid? category, ContentType? type, int page, int pageSize, bool includeUnpublished, CancellationToken ct);
    Task<ContentDetailDto?> GetBySlugAsync(string slug, bool includeUnpublished, CancellationToken ct);
    Task<IReadOnlyList<ContentSummaryDto>> SearchAsync(string query, CancellationToken ct);
    Task<PlaybackSourcesDto?> GetPlaybackAsync(Guid episodeId, CancellationToken ct);
}
