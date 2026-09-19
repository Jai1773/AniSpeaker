# Toon Speaker backend

ASP.NET Core 8 API with PostgreSQL/EF Core, Identity + JWT, admin CRUD, account watch history/later, and Cloudflare R2 presigned URLs.

Run locally from this directory:

```powershell
dotnet run --project .\ToonSpeaker.Api\ToonSpeaker.Api.csproj
```

Before first local run, set `ConnectionStrings__Default` to a PostgreSQL database and create the schema:

```powershell
.\.tools\dotnet-ef migrations add InitialCreate --project .\ToonSpeaker.Api\ToonSpeaker.Api.csproj --startup-project .\ToonSpeaker.Api\ToonSpeaker.Api.csproj
.\.tools\dotnet-ef database update --project .\ToonSpeaker.Api\ToonSpeaker.Api.csproj --startup-project .\ToonSpeaker.Api\ToonSpeaker.Api.csproj
```

Use user secrets or Render environment variables for `Jwt__Secret` (32+ random characters), `ConnectionStrings__Default`, and all `R2__*` values. Never commit production credentials.

Available endpoints:

- `GET /health`
- `GET /api/content?category=&type=Series&page=1&pageSize=24`
- `GET /api/content/{slug}`
- `GET /api/search?q=...`
- `GET /api/playback/{episodeId}`

Admin endpoints require a JWT with the `Admin` role. Promote the first admin directly in PostgreSQL once that database exists. For browser uploads, configure R2 bucket CORS for the Angular origin and send exactly the signed `Content-Type` on the PUT request.
