# Implementation Plan: Fix ToonSpeaker.Api Build Errors

## Overview
The `ToonSpeaker.Api` project is failing to build because `R2StorageService.cs` depends on AWS SDK packages and custom types that are currently missing from the project.

## Analysis
### 1. Missing Dependencies
`R2StorageService.cs` uses the following namespaces:
- `Amazon.Runtime`
- `Amazon.S3`
- `Amazon.S3.Model`

These are provided by the `AWSSDK.S3` and `AWSSDK.Core` NuGet packages.

### 2. Missing Type Definitions
Based on the usage in `R2StorageService.cs`:

- **`IStorageService`**: Interface implemented by `R2StorageService`.
- **`UploadInitRequest`**: Input for `CreateUploadAsync`. Needs `FileName`, `Folder`, and `ContentType` properties.
- **`UploadInitResponse`**: Output for `CreateUploadAsync`. Constructor signature: `(string url, string publicUrl, string objectKey, DateTimeOffset expiry)`.
- **`PlaybackDto`**: Output for `CreateReadUrlAsync`. Constructor signature: `(Guid episodeId, string url, DateTimeOffset expiry)`.

## Implementation Plan

### Step 1: Add NuGet Packages
Add the following packages to `Backend/ToonSpeaker.Api/ToonSpeaker.Api.csproj`:
- `AWSSDK.S3`
- `AWSSDK.Core`

### Step 2: Define Missing Types
Add the following definitions to `Backend/ToonSpeaker.Api/Application/Contracts.cs` under the `// ─── Service interfaces ───` section or a new dedicated section for Storage.

#### Type Definitions:
\`\`\`csharp
public sealed record UploadInitRequest(string FileName, string Folder, string ContentType);

public sealed record UploadInitResponse(string Url, string PublicUrl, string ObjectKey, DateTimeOffset Expiry);

public sealed record PlaybackDto(Guid EpisodeId, string Url, DateTimeOffset Expiry);

public interface IStorageService
{
    Task<UploadInitResponse> CreateUploadAsync(UploadInitRequest request, CancellationToken ct);
    Task<PlaybackDto> CreateReadUrlAsync(Guid episodeId, string objectKey, CancellationToken ct);
}
\`\`\`

## Verification Plan
1. Run `dotnet build Backend/ToonSpeaker.Api/ToonSpeaker.Api.csproj` to ensure all errors in `R2StorageService.cs` are resolved.
2. Verify that `R2StorageService.cs` compiles without any missing type or reference warnings.

### Critical Files for Implementation
- `Backend/ToonSpeaker.Api/ToonSpeaker.Api.csproj`
- `Backend/ToonSpeaker.Api/Application/Contracts.cs`
- `Backend/ToonSpeaker.Api/Infrastructure/Services/R2StorageService.cs`
