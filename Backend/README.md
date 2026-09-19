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

On Render, `Database:ApplyMigrations` defaults to `true`, so the checked-in EF Core migrations are applied before the API accepts requests. Set `ConnectionStrings__Default` to the Postgres **internal URL** from Render's Connect menu (for example, `postgresql://user:password@host:5432/database`). The API converts this URL to Npgsql's format and preserves query settings such as `sslmode=require`. If a migration or connection fails, the service now fails startup and logs the underlying error instead of first failing later as an empty `500` from an API endpoint. Local development keeps migrations disabled in `appsettings.Development.json`; run `database update` yourself or opt in with `Database__ApplyMigrations=true`.

Available endpoints:

- `GET /health`
- `GET /api/content?category=&type=Series&page=1&pageSize=24`
- `GET /api/content/{slug}`
- `GET /api/search?q=...`
- `GET /api/playback/{episodeId}`

`GET /health` returns `503` until PostgreSQL is reachable, so configure it as the Render health-check path.

Admin endpoints require a JWT with the `Admin` role. Promote the first admin directly in PostgreSQL once that database exists. For browser uploads, configure R2 bucket CORS for the Angular origin and send exactly the signed `Content-Type` on the PUT request.
