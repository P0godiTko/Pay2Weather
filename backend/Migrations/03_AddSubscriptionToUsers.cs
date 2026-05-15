using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WeatherBackend.Migrations
{
    public partial class AddSubscriptionToUsers : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Subscription",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 1);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Subscription",
                table: "Users");
        }
    }
}
