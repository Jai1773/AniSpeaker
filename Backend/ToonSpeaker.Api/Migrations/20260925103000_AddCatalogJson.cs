using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ToonSpeaker.Api.Migrations
{
    public partial class AddCatalogJson : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CatalogJson",
                table: "Content",
                type: "jsonb",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "CatalogJson", table: "Content");
        }
    }
}