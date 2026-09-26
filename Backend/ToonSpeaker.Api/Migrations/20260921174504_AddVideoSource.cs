using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ToonSpeaker.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVideoSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "VideoKey",
                table: "Episodes");

            migrationBuilder.CreateTable(
                name: "VideoSources",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EpisodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlayerName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Url = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Quality = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VideoSources", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VideoSources_Episodes_EpisodeId",
                        column: x => x.EpisodeId,
                        principalTable: "Episodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VideoSources_EpisodeId_SortOrder",
                table: "VideoSources",
                columns: new[] { "EpisodeId", "SortOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VideoSources");

            migrationBuilder.AddColumn<string>(
                name: "VideoKey",
                table: "Episodes",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
