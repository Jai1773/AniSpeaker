using ToonSpeaker.Api.Domain;

namespace ToonSpeaker.Api.Application;

public sealed record ContentSummaryDto(Guid Id, Guid CategoryId, string Title, string Slug, ContentType Type, string? Description, string? PosterUrl, string? BannerUrl, IReadOnlyList<string> Tags, bool Published);
public sealed record EpisodeDto(Guid Id, Guid ContentId, Guid? SeasonId, int Number, string Title, string? ThumbnailUrl, int DurationSeconds, bool Published);
public sealed record SeasonDto(Guid Id, int Number, string Title, IReadOnlyList<EpisodeDto> Episodes);
public sealed record ContentDetailDto(Guid Id, Guid CategoryId, string Title, string Slug, ContentType Type, string? Description, string? PosterUrl, string? BannerUrl, IReadOnlyList<string> Tags, bool Published, IReadOnlyList<SeasonDto> Seasons, IReadOnlyList<EpisodeDto> Episodes);
public sealed record CategoryDto(Guid Id, string Name, string Slug, int SortOrder);
public sealed record PlaybackDto(Guid EpisodeId, string VideoUrl, DateTimeOffset ExpiresAt);
public sealed record PageResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);
public sealed record CreateCategoryRequest(string Name, string Slug, int SortOrder);
public sealed record UpdateCategoryRequest(string Name, string Slug, int SortOrder);
public sealed record SaveContentRequest(Guid CategoryId, string Title, string Slug, ContentType Type, string? Description, string? PosterUrl, string? BannerUrl, string[]? Tags, bool Published);
public sealed record CreateSeasonRequest(int Number, string Title);
public sealed record SaveEpisodeRequest(int Number, string Title, string VideoKey, string? ThumbnailUrl, int DurationSeconds, bool Published);
public sealed record RegisterRequest(string Email, string Password, string DisplayName);
public sealed record LoginRequest(string Email, string Password);
public sealed record AuthResponse(string AccessToken, DateTimeOffset AccessTokenExpiresAt, string Email, string DisplayName, string Role);
public sealed record SaveHistoryRequest(Guid EpisodeId, int ProgressSeconds);
public sealed record HistoryItemDto(EpisodeDto Episode, ContentSummaryDto Content, int ProgressSeconds, DateTimeOffset LastWatchedAt);
public sealed record UploadInitRequest(string FileName, string ContentType, string Folder);
public sealed record UploadInitResponse(string UploadUrl, string PublicUrl, string ObjectKey, DateTimeOffset ExpiresAt);

public interface IContentService
{
    Task<PageResult<ContentSummaryDto>> BrowseAsync(Guid? category, ContentType? type, int page, int pageSize, bool includeUnpublished, CancellationToken ct);
    Task<ContentDetailDto?> GetBySlugAsync(string slug, bool includeUnpublished, CancellationToken ct);
    Task<IReadOnlyList<ContentSummaryDto>> SearchAsync(string query, CancellationToken ct);
    Task<PlaybackDto?> GetPlaybackAsync(Guid episodeId, CancellationToken ct);
}

public interface IStorageService
{
    Task<UploadInitResponse> CreateUploadAsync(UploadInitRequest request, CancellationToken ct);
    Task<PlaybackDto> CreateReadUrlAsync(Guid episodeId, string objectKey, CancellationToken ct);
}
