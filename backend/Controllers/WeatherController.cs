using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

[ApiController]
[Route("api/[controller]")]
public class WeatherController : ControllerBase
{
    private readonly WeatherDbContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public WeatherController(WeatherDbContext context, IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    [HttpGet("search")]
    public async Task<IActionResult> SearchCities([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 3)
            return Ok(new List<object>());

        var client = _httpClientFactory.CreateClient();
        var apiKey = _configuration["OpenWeatherMap:ApiKey"];
        var url = $"http://api.openweathermap.org/geo/1.0/direct?q={Uri.EscapeDataString(q)}&limit=10&appid={apiKey}";

        try
        {
            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode)
                return Ok(new List<object>());

            var content = await response.Content.ReadAsStringAsync();
            var cities = JsonSerializer.Deserialize<List<CitySearchResult>>(content);

            // Store search history if user is logged in, regardless of results
            var userId = GetCurrentUserId();
            if (userId.HasValue)
            {
                var search = new SearchHistory
                {
                    UserId = userId.Value,
                CityName = NormalizeCityName(q), // Save the normalized search query
                    SearchedAt = DateTime.UtcNow
                };

                _context.SearchHistory.Add(search);
                await _context.SaveChangesAsync();
            }

            if (cities == null || !cities.Any())
                return Ok(Enumerable.Empty<object>());

            return Ok(cities.Select(c => new
            {
                name = c.name,
                country = c.country,
                state = c.state,
                lat = c.lat,
                lon = c.lon
            }));
        }
        catch
        {
            return Ok(new List<object>());
        }
    }

    [HttpGet("current/{city}")]
    public async Task<IActionResult> GetCurrentWeather(string city)
    {
        var client = _httpClientFactory.CreateClient();
        var apiKey = _configuration["OpenWeatherMap:ApiKey"];
        var url = $"https://api.openweathermap.org/data/2.5/weather?q={Uri.EscapeDataString(city)}&appid={apiKey}&units=metric";

        try
        {
            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode)
                return BadRequest("City not found");

            var content = await response.Content.ReadAsStringAsync();
            var weatherData = JsonSerializer.Deserialize<WeatherResponse>(content);

            // Store weather history if user is logged in
            var userId = GetCurrentUserId();
            if (userId.HasValue && weatherData != null)
            {
                var fullCityName = city;
                
                // Only append country if city doesn't already contain a comma (no country info)
                if (!city.Contains(","))
                {
                    var countryName = GetCountryName(weatherData.sys.country);
                    fullCityName = string.IsNullOrWhiteSpace(countryName) ? city : $"{city}, {countryName}";
                }

                fullCityName = NormalizeCityName(fullCityName);
                
                var history = new WeatherHistory
                {
                    UserId = userId.Value,
                    CityName = fullCityName,
                    Temperature = weatherData.main.temp,
                    Condition = weatherData.weather.FirstOrDefault()?.main ?? "Unknown",
                    Humidity = weatherData.main.humidity,
                    WindSpeed = weatherData.wind.speed,
                    RecordedAt = DateTime.UtcNow
                };

                _context.WeatherHistory.Add(history);
                await _context.SaveChangesAsync();
            }

            return Ok(weatherData);
        }
        catch
        {
            return BadRequest("Failed to fetch weather data");
        }
    }

    [HttpGet("current")]
    [AllowAnonymous]
    public async Task<IActionResult> GetCurrentWeather([FromQuery] string? city, [FromQuery] double? lat, [FromQuery] double? lon, [FromQuery] string? cityname, [FromQuery] bool save = true)
    {
        if ((!lat.HasValue || !lon.HasValue) && string.IsNullOrWhiteSpace(city))
            return BadRequest("City or coordinates required");

        var client = _httpClientFactory.CreateClient();
        var apiKey = _configuration["OpenWeatherMap:ApiKey"];
        var url = lat.HasValue && lon.HasValue
            ? $"https://api.openweathermap.org/data/2.5/weather?lat={lat.Value}&lon={lon.Value}&appid={apiKey}&units=metric"
            : $"https://api.openweathermap.org/data/2.5/weather?q={Uri.EscapeDataString(city!)}&appid={apiKey}&units=metric";

        try
        {
            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode)
                return BadRequest("City not found");

            var content = await response.Content.ReadAsStringAsync();
            var weatherData = JsonSerializer.Deserialize<WeatherResponse>(content);

            var userId = GetCurrentUserId();

            if (save && userId.HasValue && weatherData != null)
            {
                var historyCityName = !string.IsNullOrWhiteSpace(cityname) ? cityname : (city ?? weatherData.name);
                historyCityName = NormalizeCityName(historyCityName);

                var history = new WeatherHistory
                {
                    UserId = userId.Value,
                    CityName = historyCityName,
                    Temperature = weatherData.main.temp,
                    Condition = weatherData.weather.FirstOrDefault()?.main ?? "Unknown",
                    Humidity = weatherData.main.humidity,
                    WindSpeed = weatherData.wind.speed,
                    RecordedAt = DateTime.UtcNow
                };

                _context.WeatherHistory.Add(history);
                await _context.SaveChangesAsync();
            }

            return Ok(weatherData);
        }
        catch
        {
            return BadRequest("Failed to fetch weather data");
        }
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetWeatherHistory([FromQuery] string city, [FromQuery] int days = 7)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var cutoffDate = DateTime.UtcNow.AddDays(-days);
        var history = await _context.WeatherHistory
            .Where(wh => wh.UserId == userId.Value && wh.CityName == city && wh.RecordedAt >= cutoffDate)
            .OrderByDescending(wh => wh.RecordedAt)
            .Take(50)
            .ToListAsync();

        return Ok(history.Select(h => new
        {
            h.RecordedAt,
            h.Temperature,
            h.Condition,
            h.Humidity,
            h.WindSpeed
        }));
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        return userIdClaim != null && int.TryParse(userIdClaim.Value, out var id) ? id : null;
    }

    private string GetCountryName(string countryCode)
    {
        if (string.IsNullOrWhiteSpace(countryCode))
            return "";

        // Dictionary of country codes to full names
        var countries = new Dictionary<string, string>
        {
            { "US", "United States" }, { "GB", "United Kingdom" }, { "FR", "France" }, { "DE", "Germany" },
            { "IT", "Italy" }, { "ES", "Spain" }, { "PT", "Portugal" }, { "NL", "Netherlands" },
            { "BE", "Belgium" }, { "CH", "Switzerland" }, { "AT", "Austria" }, { "SE", "Sweden" },
            { "NO", "Norway" }, { "DK", "Denmark" }, { "FI", "Finland" }, { "IE", "Ireland" },
            { "PL", "Poland" }, { "CZ", "Czechia" }, { "SK", "Slovakia" }, { "HR", "Croatia" },
            { "RO", "Romania" }, { "GR", "Greece" }, { "TR", "Turkey" }, { "RU", "Russia" },
            { "UA", "Ukraine" }, { "BY", "Belarus" }, { "LT", "Lithuania" }, { "LV", "Latvia" },
            { "EE", "Estonia" }, { "CA", "Canada" }, { "MX", "Mexico" }, { "BR", "Brazil" },
            { "AR", "Argentina" }, { "CL", "Chile" }, { "CO", "Colombia" }, { "PE", "Peru" },
            { "JP", "Japan" }, { "CN", "China" }, { "IN", "India" }, { "AU", "Australia" },
            { "NZ", "New Zealand" }, { "KR", "South Korea" }, { "TH", "Thailand" }, { "SG", "Singapore" },
            { "MY", "Malaysia" }, { "PH", "Philippines" }, { "ID", "Indonesia" }, { "VN", "Vietnam" },
            { "ZA", "South Africa" }, { "EG", "Egypt" }, { "NG", "Nigeria" }, { "AE", "United Arab Emirates" },
            { "SA", "Saudi Arabia" }, { "IL", "Israel" }, { "HK", "Hong Kong" }, { "TW", "Taiwan" }
        };

        return countries.ContainsKey(countryCode.ToUpper()) ? countries[countryCode.ToUpper()] : countryCode;
    }

    private string NormalizeCityName(string cityName)
    {
        if (string.IsNullOrWhiteSpace(cityName))
            return cityName;

        var parts = cityName.Split(',').Select(p => p.Trim()).Where(p => !string.IsNullOrEmpty(p)).ToList();
        while (parts.Count >= 2 && string.Equals(parts[^1], parts[^2], StringComparison.OrdinalIgnoreCase))
        {
            parts.RemoveAt(parts.Count - 1);
        }

        return string.Join(", ", parts);
    }
}

public class CitySearchResult
{
    public string name { get; set; } = null!;
    public string country { get; set; } = null!;
    public string state { get; set; } = null!;
    public double lat { get; set; }
    public double lon { get; set; }
    public Dictionary<string, string> local_names { get; set; } = new Dictionary<string, string>();
}

public class WeatherResponse
{
    public string name { get; set; } = null!;
    public Main main { get; set; } = null!;
    public List<Weather> weather { get; set; } = new List<Weather>();
    public Wind wind { get; set; } = null!;
    public Sys sys { get; set; } = null!;
    public int visibility { get; set; }
}

public class Main
{
    public double temp { get; set; }
    public int humidity { get; set; }
    public int pressure { get; set; }
    public double feels_like { get; set; }
}

public class Weather
{
    public string main { get; set; } = null!;
    public string description { get; set; } = null!;
    public string icon { get; set; } = null!;
}

public class Wind
{
    public double speed { get; set; }
}

public class Sys
{
    public string country { get; set; } = null!;
    public long sunrise { get; set; }
}