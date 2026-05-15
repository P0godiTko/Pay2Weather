using Microsoft.EntityFrameworkCore;

public class WeatherDbContext : DbContext
{
    public WeatherDbContext(DbContextOptions<WeatherDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<FavoriteCity> FavoriteCities { get; set; }
    public DbSet<WeatherHistory> WeatherHistory { get; set; }
    public DbSet<SearchHistory> SearchHistory { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasMany(u => u.FavoriteCities)
            .WithOne(fc => fc.User)
            .HasForeignKey(fc => fc.UserId);

        modelBuilder.Entity<User>()
            .HasMany(u => u.WeatherHistory)
            .WithOne(wh => wh.User)
            .HasForeignKey(wh => wh.UserId);

        modelBuilder.Entity<User>()
            .HasMany(u => u.SearchHistory)
            .WithOne(sh => sh.User)
            .HasForeignKey(sh => sh.UserId);

        modelBuilder.Entity<FavoriteCity>()
            .HasIndex(fc => new { fc.UserId, fc.CityName, fc.Country })
            .IsUnique();
    }
}

public class User
{
    public int Id { get; set; }
    public string Username { get; set; }
    public string Email { get; set; }
    public string PasswordHash { get; set; }
    public int Subscription { get; set; } = 1;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }

    public ICollection<FavoriteCity> FavoriteCities { get; set; }
    public ICollection<WeatherHistory> WeatherHistory { get; set; }
    public ICollection<SearchHistory> SearchHistory { get; set; }
}

public class FavoriteCity
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string CityName { get; set; }
    public string Country { get; set; }
    public string? LocationName { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public DateTime AddedAt { get; set; }

    public User User { get; set; }
}

public class WeatherHistory
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string CityName { get; set; }
    public double Temperature { get; set; }
    public string Condition { get; set; }
    public int Humidity { get; set; }
    public double WindSpeed { get; set; }
    public DateTime RecordedAt { get; set; }

    public User User { get; set; }
}

public class SearchHistory
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string CityName { get; set; }
    public string Country { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public DateTime SearchedAt { get; set; }

    public User User { get; set; }
}