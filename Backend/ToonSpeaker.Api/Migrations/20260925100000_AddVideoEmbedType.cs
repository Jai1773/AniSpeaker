using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ToonSpeaker.Api.Migrations
{
    public partial class AddVideoEmbedType : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EmbedType",
                table: "VideoSources",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Iframe");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmbedType",
                table: "VideoSources");
        }
    }
}