using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ToonSpeaker.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddContentIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

            migrationBuilder.Sql("CREATE INDEX \"IX_Content_Description\" ON \"Content\" USING gin (\"Description\" gin_trgm_ops);");
            migrationBuilder.Sql("CREATE INDEX \"IX_Content_Title\" ON \"Content\" USING gin (\"Title\" gin_trgm_ops);");

            migrationBuilder.CreateIndex(
                name: "IX_Content_Published_CategoryId_Type",
                table: "Content",
                columns: new[] { "Published", "CategoryId", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_Content_UpdatedAt",
                table: "Content",
                column: "UpdatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Content_Description",
                table: "Content");

            migrationBuilder.DropIndex(
                name: "IX_Content_Published_CategoryId_Type",
                table: "Content");

            migrationBuilder.DropIndex(
                name: "IX_Content_Title",
                table: "Content");

            migrationBuilder.DropIndex(
                name: "IX_Content_UpdatedAt",
                table: "Content");
        }
    }
}
