using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly WeatherDbContext _context;

    public UsersController(WeatherDbContext context)
    {
        _context = context;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterModel model)
    {
        if (await _context.Users.AnyAsync(u => u.Username == model.Username || u.Email == model.Email))
            return BadRequest("Username or email already exists");

        var user = new User
        {
            Username = model.Username,
            Email = model.Email,
            PasswordHash = HashPassword(model.Password),
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok(new { message = "User registered successfully" });
    }

    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await _context.Users
            .Include(u => u.FavoriteCities)
            .FirstOrDefaultAsync(u => u.Id == userId.Value);

        if (user == null) return NotFound();

        return Ok(new
        {
            user.Id,
            user.Username,
            user.Email,
            user.Subscription,
            user.CreatedAt,
            user.LastLoginAt,
            FavoriteCities = user.FavoriteCities.Select(fc => new
            {
                fc.Id,
                fc.CityName,
                fc.Country,
                fc.LocationName,
                fc.Latitude,
                fc.Longitude,
                fc.AddedAt
            })
        });
    }

    [HttpGet("all")]
    public async Task<IActionResult> GetAllUsers()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var currentUser = await _context.Users.FindAsync(userId.Value);
        if (currentUser == null || currentUser.Subscription != 3)
            return Forbid();

        var users = await _context.Users
            .OrderBy(u => u.Username)
            .Select(u => new
            {
                u.Id,
                u.Username,
                u.Email,
                u.Subscription
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpPut("{id}/subscription")]
    public async Task<IActionResult> UpdateSubscription(int id, [FromBody] SubscriptionUpdateModel model)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var currentUser = await _context.Users.FindAsync(userId.Value);
        if (currentUser == null || currentUser.Subscription != 3)
            return Forbid();

        if (userId.Value == id)
            return BadRequest("Tier 3 admins cannot update their own subscription.");

        if (model == null)
            return BadRequest("Invalid request body.");

        if (model.Subscription < 1 || model.Subscription > 3)
            return BadRequest("Invalid subscription tier.");

        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        user.Subscription = model.Subscription;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            user.Id,
            user.Username,
            user.Email,
            user.Subscription
        });
    }

    [HttpPost("favorites")]
    public async Task<IActionResult> AddFavorite([FromBody] FavoriteCityModel model)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        model.CityName = model.CityName?.Trim();
        model.Country = model.Country?.Trim();
        model.LocationName = model.LocationName?.Trim();

        if (await _context.FavoriteCities.AnyAsync(fc =>
            fc.UserId == userId.Value && fc.CityName == model.CityName && fc.Country == model.Country))
            return BadRequest("City already in favorites for this country");

        var favorite = new FavoriteCity
        {
            UserId = userId.Value,
            CityName = model.CityName,
            Country = model.Country,
            LocationName = model.LocationName,
            Latitude = model.Latitude,
            Longitude = model.Longitude,
            AddedAt = DateTime.UtcNow
        };

        _context.FavoriteCities.Add(favorite);
        await _context.SaveChangesAsync();

        return Ok(new { message = "City added to favorites" });
    }

    [HttpDelete("favorites/{id}")]
    public async Task<IActionResult> RemoveFavorite(int id)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var favorite = await _context.FavoriteCities
            .FirstOrDefaultAsync(fc => fc.Id == id && fc.UserId == userId.Value);

        if (favorite == null) return NotFound();

        _context.FavoriteCities.Remove(favorite);
        await _context.SaveChangesAsync();

        return Ok(new { message = "City removed from favorites" });
    }

    [HttpGet("searches/recent")]
    public async Task<IActionResult> GetRecentSearches(int count = 10)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var searches = await _context.WeatherHistory
            .Where(wh => wh.UserId == userId.Value)
            .OrderByDescending(wh => wh.RecordedAt)
            .Take(count)
            .Select(wh => new
            {
                wh.CityName,
                Temperature = (double?)null, // No temperature for searches
                SearchedAt = wh.RecordedAt
            })
            .ToListAsync();

        return Ok(searches);
    }

    [HttpGet("searches/top")]
    public async Task<IActionResult> GetTopSearches(int count = 5)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var topSearches = await _context.WeatherHistory
            .Where(wh => wh.UserId == userId.Value)
            .GroupBy(wh => wh.CityName)
            .Select(g => new
            {
                CityName = g.Key,
                Count = g.Count(),
                LastTemperature = (double?)null, // No temperature for searches
                LastSearchedAt = g.Max(x => x.RecordedAt)
            })
            .OrderByDescending(x => x.Count)
            .ThenByDescending(x => x.LastSearchedAt)
            .Take(count)
            .ToListAsync();

        return Ok(topSearches);
    }

    [HttpGet("searches/conditions")]
    public async Task<IActionResult> GetSearchConditionCounts()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var conditionCounts = await _context.WeatherHistory
            .Where(wh => wh.UserId == userId.Value)
            .GroupBy(wh => wh.Condition)
            .Select(g => new
            {
                Condition = g.Key,
                Count = g.Count()
            })
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.Condition)
            .ToListAsync();

        return Ok(conditionCounts);
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        return userIdClaim != null && int.TryParse(userIdClaim.Value, out var id) ? id : null;
    }

    private string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(password);
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hash);
    }
}

public class SubscriptionUpdateModel
{
    public int Subscription { get; set; }
}

public class FavoriteCityModel
{
    public string CityName { get; set; }
    public string Country { get; set; }
    public string? LocationName { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}