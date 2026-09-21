using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using ToonSpeaker.Api.Application;

namespace ToonSpeaker.Api.Infrastructure.Services;

public sealed class R2Options
{
    public string AccountId { get; init; } = string.Empty;
    public string AccessKey { get; init; } = string.Empty;
    public string SecretKey { get; init; } = string.Empty;
    public string BucketName { get; init; } = string.Empty;
    public string PublicBaseUrl { get; init; } = string.Empty;
}

public sealed class R2StorageService(R2Options options) : IStorageService
{
    private readonly R2Options _options = options;
    private readonly IAmazonS3? _client = CreateClient(options);

    public Task<UploadInitResponse> CreateUploadAsync(UploadInitRequest request, CancellationToken ct)
    {
        if (_client is null || string.IsNullOrWhiteSpace(_options.BucketName))
            throw new InvalidOperationException("R2 storage is not configured.");

        var safeName = Path.GetFileName(request.FileName).Replace(" ", "-");
        var folder = request.Folder.Trim('/').ToLowerInvariant();
        if (folder is not ("videos" or "images" or "thumbnails"))
            throw new ArgumentException("folder must be videos, images, or thumbnails.");

        var objectKey = $"{folder}/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}-{safeName}";
        var expiry = DateTimeOffset.UtcNow.AddMinutes(15);
        var url = _client.GetPreSignedURL(new GetPreSignedUrlRequest
        {
            BucketName = _options.BucketName,
            Key = objectKey,
            Verb = HttpVerb.PUT,
            Expires = expiry.UtcDateTime,
            ContentType = request.ContentType
        });
        return Task.FromResult(new UploadInitResponse(url, BuildPublicUrl(objectKey), objectKey, expiry));
    }

    public Task<PlaybackDto> CreateReadUrlAsync(Guid episodeId, string objectKey, CancellationToken ct)
    {
        var expiry = DateTimeOffset.UtcNow.AddMinutes(30);
        if (!string.IsNullOrWhiteSpace(_options.PublicBaseUrl))
            return Task.FromResult(new PlaybackDto(episodeId, BuildPublicUrl(objectKey), expiry));

        if (_client is null)
            return Task.FromResult(new PlaybackDto(episodeId, objectKey, expiry));

        var url = _client.GetPreSignedURL(new GetPreSignedUrlRequest
        {
            BucketName = _options.BucketName,
            Key = objectKey,
            Verb = HttpVerb.GET,
            Expires = expiry.UtcDateTime
        });
        return Task.FromResult(new PlaybackDto(episodeId, url, expiry));
    }

    private string BuildPublicUrl(string key) =>
        string.IsNullOrWhiteSpace(_options.PublicBaseUrl) ? key : $"{_options.PublicBaseUrl.TrimEnd('/')}/{key}";

    private static IAmazonS3? CreateClient(R2Options options)
    {
        if (string.IsNullOrWhiteSpace(options.AccountId) ||
            string.IsNullOrWhiteSpace(options.AccessKey) ||
            string.IsNullOrWhiteSpace(options.SecretKey))
        {
            return null;
        }

        return new AmazonS3Client(
            new BasicAWSCredentials(options.AccessKey, options.SecretKey),
            new AmazonS3Config
            {
                ServiceURL = $"https://{options.AccountId}.r2.cloudflarestorage.com",
                ForcePathStyle = true
            });
    }
}
