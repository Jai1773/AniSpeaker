using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using ToonSpeaker.Api.Domain;

namespace ToonSpeaker.Api.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser, Microsoft.AspNetCore.Identity.IdentityRole<Guid>, Guid>(options)
{
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Content> Content => Set<Content>();
    public DbSet<Season> Seasons => Set<Season>();
    public DbSet<Episode> Episodes => Set<Episode>();
    public DbSet<VideoSource> VideoSources => Set<VideoSource>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<WatchHistory> WatchHistory => Set<WatchHistory>();
    public DbSet<WatchLater> WatchLater => Set<WatchLater>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Category>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
            e.Property(x => x.Name).HasMaxLength(120);
        });

        builder.Entity<Content>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
            e.HasIndex(x => new { x.Published, x.CategoryId, x.Type });
            e.HasIndex(x => x.UpdatedAt);
            e.HasIndex(x => x.Title).HasMethod("gin_trgm_ops");
            e.HasIndex(x => x.Description).HasMethod("gin_trgm_ops");
            e.Property(x => x.Type).HasConversion<string>();
            e.Property(x => x.Tags).HasColumnType("text[]");
            e.Property(x => x.CatalogJson).HasColumnType("jsonb");
            e.HasOne(x => x.Category)
             .WithMany(x => x.Content)
             .HasForeignKey(x => x.CategoryId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<Season>(e =>
            e.HasIndex(x => new { x.ContentId, x.Number }).IsUnique());

        builder.Entity<Episode>(e =>
        {
            e.HasIndex(x => new { x.ContentId, x.SeasonId, x.Number }).IsUnique();
            e.HasOne(x => x.Content)
             .WithMany(x => x.Episodes)
             .HasForeignKey(x => x.ContentId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Season)
             .WithMany(x => x.Episodes)
             .HasForeignKey(x => x.SeasonId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<VideoSource>(e =>
        {
            e.HasOne(x => x.Episode)
             .WithMany(x => x.VideoSources)
             .HasForeignKey(x => x.EpisodeId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.EpisodeId, x.SortOrder });
            e.Property(x => x.PlayerName).HasMaxLength(50);
            e.Property(x => x.Url).HasMaxLength(1000);
            e.Property(x => x.EmbedType).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Quality).HasMaxLength(20);
        });

        builder.Entity<AppUser>(e => e.Property(x => x.Role).HasMaxLength(32));
        builder.Entity<RefreshToken>(e => e.HasIndex(x => x.TokenHash).IsUnique());
        builder.Entity<WatchHistory>(e => e.HasIndex(x => new { x.UserId, x.EpisodeId }).IsUnique());
        builder.Entity<WatchLater>(e => e.HasIndex(x => new { x.UserId, x.ContentId }).IsUnique());
    }
}
