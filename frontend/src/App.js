import React, { useState, useEffect } from 'react';
import './App.css';
import './Auth.css';
import 'weather-icons/css/weather-icons.css';
import {
  hasPermission,
  getUserSubscription as getUserSubscriptionForUser,
  isTier1Subscription as isTier1SubscriptionForUser,
  isTier2Subscription as isTier2SubscriptionForUser,
  isTier3Subscription as isTier3SubscriptionForUser,
  canManageUsers as canManageUsersForUser,
  normalizeSubscription,
} from './permissions';

function App() {
  const [weather, setWeather] = useState(null);
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('');
  
  // Authentication state
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [favorites, setFavorites] = useState([]);
  const [weatherHistory, setWeatherHistory] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [displayCityName, setDisplayCityName] = useState(null);
  const [currentLocationWeather, setCurrentLocationWeather] = useState(null);
  const [currentLocationError, setCurrentLocationError] = useState(null);
  const [loadingCurrentLocation, setLoadingCurrentLocation] = useState(false);
  const [conditionsTab, setConditionsTab] = useState('overview');
  const [forecastDays, setForecastDays] = useState(4);
  const [forecastData, setForecastData] = useState([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSection, setProfileSection] = useState('account');
  const [searchesView, setSearchesView] = useState('top5');
  const [topSearches, setTopSearches] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [searchesLoading, setSearchesLoading] = useState(false);
  const [topSearchesError, setTopSearchesError] = useState(null);
  const [recentSearchesError, setRecentSearchesError] = useState(null);
  const [conditionCounts, setConditionCounts] = useState([]);
  const [conditionCountsError, setConditionCountsError] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);
  const [userManagementMessage, setUserManagementMessage] = useState(null);

  const API_BASE_URL = 'http://localhost:5000/api';
  const API_KEY = '285e2a3fbb51963e41afd1abbab519c7'; // Replace with your API key

  const selectCity = (result) => {
    const fullCityName = `${result.name}, ${getCountryName(result.country)}`;
    setSelectedLocation(result);
    setCity(fullCityName);
    setDisplayCityName(result.name);
    setSearchResults([]);
    setShowSearchDropdown(false);
    fetchWeather({ lat: result.lat, lon: result.lon }, fullCityName);
  };

const getCountryName = (countryCode) => {
  if (!countryCode) return '';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode.toUpperCase());
  } catch {
    return countryCode;
  }
};

const getUserSubscription = () => getUserSubscriptionForUser(user);

const isTier1Subscription = () => isTier1SubscriptionForUser(user);
const isTier2Subscription = () => isTier2SubscriptionForUser(user);
const isTier3Subscription = () => isTier3SubscriptionForUser(user);
const canManageUsers = () => canManageUsersForUser(user);

const advancedWeatherDetailsUnlocked = () => {
  return hasPermission(user, 'favourites');
};

const normalizeCity = (cityName) => {
  // Normalize for comparison: remove "City of", trim, lowercase
  return cityName.replace(/^City of\s+/i, '').trim().toLowerCase();
};

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
};

const getFavoriteCityName = () => {
  return displayCityName || weather?.name || city;
};

const getDisplayLocation = () => {
  if (!weather) return '';
  const name = displayCityName || weather.name || city;
  if (!name) return '';
  return name.includes(',') ? name : `${name}, ${getCountryName(weather.sys.country)}`;
};

const isFavoriteMatch = (fav) => {
    if (weather?.coord?.lat != null && weather?.coord?.lon != null && fav.latitude != null && fav.longitude != null) {
      return fav.latitude === weather.coord.lat && fav.longitude === weather.coord.lon;
    }

    return fav.cityName === getFavoriteCityName() && fav.country === weather?.sys?.country;
  };

const formatSubscriptionLabel = (subscription) => {
  const normalized = normalizeSubscription(subscription);
  if (normalized === 'free') return 'FREE';
  if (normalized === 'tier_1') return 'TIER 1';
  if (normalized === 'tier_2') return 'TIER 2';
  if (normalized === 'tier_3') return 'TIER 3';
  return String(subscription).toUpperCase();
};

const getFavoriteLimit = () => {
  if (isTier1Subscription()) return 2;
  if (isTier2Subscription()) return 3;
  if (isTier3Subscription()) return Infinity;
  return Infinity;
};

const favoriteLimit = getFavoriteLimit();
const favoriteLockMessage = () => {
  if (isTier1Subscription()) return 'Additional favorites are restricted for Tier 1 users.';
  if (isTier2Subscription()) return 'Additional favorites are restricted for Tier 2 users.';
  return 'Additional favorites are restricted for your subscription tier.';
};

const getDisplaySubscription = () => {
  const normalized = getUserSubscription();
  if (normalized === 'free') return 'FREE';
  if (normalized === 'tier_1') return 'TIER 1';
  if (normalized === 'tier_2') return 'TIER 2';
  if (normalized === 'tier_3') return 'TIER 3';
  return 'TIER 1';
};

const getWeatherIconClass = (iconCode) => {
  const iconMap = {
    '01d': 'wi-day-sunny',
    '01n': 'wi-night-clear',
    '02d': 'wi-day-cloudy',
    '02n': 'wi-night-alt-cloudy',
    '03d': 'wi-cloudy',
    '03n': 'wi-cloudy',
    '04d': 'wi-cloudy',
    '04n': 'wi-cloudy',
    '09d': 'wi-showers',
    '09n': 'wi-showers',
    '10d': 'wi-rain',
    '10n': 'wi-rain',
    '11d': 'wi-thunderstorm',
    '11n': 'wi-thunderstorm',
    '13d': 'wi-snow',
    '13n': 'wi-snow',
    '50d': 'wi-fog',
    '50n': 'wi-fog',
  };
  return iconMap[iconCode] || 'wi-day-sunny';
};

const weatherIconCode = weather?.weather?.[0]?.icon;

const forecastBounds = () => {
  if (forecastData.length === 0) return { minTemp: 0, maxTemp: 0 };
  const temps = forecastData.map(f => f.avgTemp);
  const rawMaxTemp = Math.max(...temps);
  const rawMinTemp = Math.min(...temps);
  const minTemp = Math.floor(rawMinTemp / 5) * 5;
  const maxTemp = Math.ceil(rawMaxTemp / 5) * 5;
  return { minTemp, maxTemp };
};

const forecastLinePath = () => {
  if (forecastData.length === 0) return '';
  const { minTemp, maxTemp } = forecastBounds();
  const pointCount = forecastData.length;
  const pointMargin = 30;
  const chartLeft = 40 + pointMargin;
  const chartRight = 480 - pointMargin;
  const chartWidth = chartRight - chartLeft;
  const chartBottom = 244;
  const chartTop = 20;
  const chartHeight = chartBottom - chartTop;

  return forecastData
    .map((day, index) => {
      const x = pointCount === 1
        ? chartLeft + chartWidth / 2
        : chartLeft + (index / (pointCount - 1)) * chartWidth;
      const y = chartBottom - ((day.avgTemp - minTemp) / (maxTemp - minTemp || 1)) * chartHeight;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
};

const forecastGridLines = () => {
  if (forecastData.length === 0) return [];
  const { minTemp, maxTemp } = forecastBounds();
  const stepSize = 5;
  const stepCount = Math.ceil((maxTemp - minTemp) / stepSize) + 1;
  const chartBottom = 244;
  const chartTop = 20;
  const chartHeight = chartBottom - chartTop;

  return Array.from({ length: stepCount }, (_, index) => {
    const temp = minTemp + index * stepSize;
    const y = chartBottom - ((temp - minTemp) / (maxTemp - minTemp || 1)) * chartHeight;
    return { y, temp };
  });
};

  // API helper function
  const apiRequest = async (endpoint, options = {}) => {
    const { skipAuth = false, ...fetchOptions } = options;
    const headers = {
      ...fetchOptions.headers,
    };

    if (fetchOptions.method && fetchOptions.method.toUpperCase() !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }
    
    if (token && !skipAuth) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
    });
    
    if (response.status === 401) {
      logout();
      throw new Error('Authentication required');
    }
    
    return response;
  };

  // Authentication functions
  const login = async (username, password) => {
    console.log('Attempting login for:', username);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      console.log('Login response status:', response.status);
      const data = await response.json();
      console.log('Login response body:', data);
      
      if (!response.ok) {
        const message = data?.message || response.statusText || 'Login failed';
        throw new Error(`Login failed: ${response.status} - ${message}`);
      }
      
      if (!data?.token) {
        throw new Error('Login failed: invalid response from server');
      }

      const normalizedSubscription = data.user?.subscription || data.user?.Subscription || 1;
      const loggedInUser = data.user
        ? {
            id: data.user.id,
            username: data.user.username,
            email: data.user.email,
            subscription: normalizedSubscription,
            Subscription: normalizedSubscription,
          }
        : { username, subscription: 1, Subscription: 1 };

      setToken(data.token);
      setUser(loggedInUser);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(loggedInUser));
      setShowAuth(false);
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  };

  const register = async (username, email, password) => {
    console.log('Attempting register for:', username, email);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      
      console.log('Register response status:', response.status);
      const data = await response.json();
      console.log('Register response body:', data);
      
      if (!response.ok) {
        const message = data?.message || response.statusText || 'Registration failed';
        throw new Error(`Registration failed: ${response.status} - ${message}`);
      }
      
      await login(username, password);
    } catch (error) {
      console.error('Register error:', error);
      throw new Error(error.message || 'Registration failed');
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setFavorites([]);
    setWeatherHistory([]);
    setCurrentLocationWeather(null);
    setCurrentLocationError(null);
    setProfileOpen(false);
    setWeather(null);
    setCity('');
    setLoading(false);
    setError(null);
    setSelectedLocation(null);
    setDisplayCityName(null);
    setConditionsTab('overview');
    setForecastDays(4);
    setForecastData([]);
    setForecastLoading(false);
    setForecastError(null);
    setSearchesView('top5');
    setTopSearches([]);
    setRecentSearches([]);
    setSearchesLoading(false);
    setTopSearchesError(null);
    setRecentSearchesError(null);
    setConditionCounts([]);
    setConditionCountsError(null);
    setActiveSection('');
    setShowSearchDropdown(false);
    setSearchResults([]);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const loadUserData = async (overrideToken) => {
    const authToken = overrideToken || token;
    if (!authToken) return;
    
    try {
      const response = await apiRequest('/users/profile', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        const normalizedSubscription = data.subscription || data.Subscription || 1;
        const currentUser = {
          id: data.id,
          username: data.username,
          email: data.email,
          subscription: normalizedSubscription,
          Subscription: normalizedSubscription,
        };
        setUser(currentUser);
        localStorage.setItem('user', JSON.stringify(currentUser));
        setFavorites(data.favoriteCities || data.FavoriteCities || []);
      } else if (response.status === 401) {
        logout();
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  const mapTopSearchItem = (item) => ({
    cityName: item.cityName || item.CityName || '',
    count: item.count ?? item.Count ?? 0,
    lastTemperature: item.lastTemperature ?? item.LastTemperature ?? null,
    lastSearchedAt: item.lastSearchedAt || item.LastSearchedAt || '',
  });

  const mapRecentSearchItem = (item) => ({
    cityName: item.cityName || item.CityName || '',
    temperature: item.temperature ?? item.Temperature ?? null,
    recordedAt: item.recordedAt || item.RecordedAt || item.SearchedAt || item.searchedAt || '',
  });

  const loadTopSearches = async (count = 5) => {
    const response = await apiRequest(`/users/searches/top?count=${count}`);
    if (!response.ok) {
      throw new Error('Failed to load top searches');
    }
    const data = await response.json();
    return Array.isArray(data) ? data.map(mapTopSearchItem) : [];
  };

  const loadRecentSearches = async (count = 10) => {
    const response = await apiRequest(`/users/searches/recent?count=${count}`);
    if (!response.ok) {
      throw new Error('Failed to load recent searches');
    }
    const data = await response.json();
    return Array.isArray(data) ? data.map(mapRecentSearchItem) : [];
  };

  const loadConditionCounts = async () => {
    const response = await apiRequest('/users/searches/conditions');
    if (!response.ok) {
      throw new Error('Failed to load condition counts');
    }
    const data = await response.json();
    return Array.isArray(data)
      ? data.map(item => ({
          condition: item.condition || item.Condition || '',
          count: item.count ?? item.Count ?? 0,
        }))
      : [];
  };

  const loadSearchesData = async () => {
    if (!token) return;
    setSearchesLoading(true);
    setTopSearchesError(null);
    setRecentSearchesError(null);
    setConditionCountsError(null);

    try {
      const topData = await loadTopSearches();
      setTopSearches(topData || []);
    } catch (error) {
      console.error('Failed to load top searches:', error);
      setTopSearchesError(error.message || 'Failed to load top searches.');
      setTopSearches([]);
    }

    try {
      const recentData = await loadRecentSearches();
      setRecentSearches(recentData || []);
    } catch (error) {
      console.error('Failed to load recent searches:', error);
      setRecentSearchesError(error.message || 'Failed to load recent searches.');
      setRecentSearches([]);
    }

    try {
      const countsData = await loadConditionCounts();
      setConditionCounts(countsData || []);
    } catch (error) {
      console.error('Failed to load condition counts:', error);
      setConditionCountsError(error.message || 'Failed to load condition history.');
      setConditionCounts([]);
    }

    setSearchesLoading(false);
  };

  const loadUsersList = async () => {
    if (!token) return;
    setUsersLoading(true);
    setUsersError(null);
    setUserManagementMessage(null);

    try {
      const response = await apiRequest('/users/all');
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to load users');
      }

      const data = await response.json();
      const users = Array.isArray(data)
        ? data.map((item) => ({
            id: item.id,
            username: item.username || item.Username || '',
            email: item.email || item.Email || '',
            subscription: item.subscription ?? item.Subscription ?? 0,
          }))
        : [];
      setUsersList(users);
    } catch (error) {
      console.error('Failed to load users list:', error);
      setUsersError(error.message || 'Unable to load users.');
      setUsersList([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const updateUserSubscription = async (userId, subscriptionValue) => {
    if (!token) return;
    setUsersError(null);
    setUserManagementMessage(null);

    try {
      const response = await apiRequest(`/users/${userId}/subscription`, {
        method: 'PUT',
        body: JSON.stringify({ subscription: Number(subscriptionValue) }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to update subscription');
      }

      const updatedUser = await response.json();
      setUsersList((prevList) => prevList.map((item) => item.id === updatedUser.id ? {
        ...item,
        subscription: updatedUser.subscription ?? updatedUser.Subscription ?? item.subscription,
      } : item));
      setUserManagementMessage('User subscription updated successfully.');
    } catch (error) {
      console.error('Failed to update user subscription:', error);
      setUsersError(error.message || 'Unable to update user subscription.');
    }
  };

  const addFavorite = async (cityName, country, latitude = null, longitude = null, locationName = null) => {
    if (!token) return;
    
    try {
      console.log('Adding favorite:', cityName, country, latitude, longitude, locationName);
      const response = await apiRequest('/users/favorites', {
        method: 'POST',
        body: JSON.stringify({ 
          cityName, 
          country,
          locationName,
          latitude,
          longitude
        }),
      });
      
      console.log('Add favorite response:', response.status, response.ok);
      if (response.ok) {
        console.log('Favorite added successfully');
        setError(null);
        await loadUserData();
      } else {
        const message = await response.text();
        console.log('Add favorite failed:', message);
        setError(message || 'Failed to add favorite');
      }
    } catch (error) {
      console.error('Failed to add favorite:', error);
      setError(error.message || 'Failed to add favorite');
    }
  };

  const removeFavorite = async (favoriteId) => {
    if (!token) return;
    
    try {
      console.log('Removing favorite ID:', favoriteId);
      const response = await apiRequest(`/users/favorites/${favoriteId}`, {
        method: 'DELETE',
      });
      
      console.log('Remove favorite response:', response.status, response.ok);
      if (response.ok) {
        console.log('Favorite removed successfully');
        await loadUserData();
      } else {
        console.log('Remove favorite failed:', await response.text());
      }
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  };

  const loadCurrentLocationWeather = async () => {
    if (!token || !user) {
      return;
    }

    if (!navigator.geolocation) {
      setCurrentLocationError('Geolocation is not supported by this browser.');
      return;
    }

    if ('permissions' in navigator) {
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        if (status.state === 'denied') {
          setCurrentLocationError('Location access is blocked in browser settings. Enable it and refresh.');
          return;
        }
      } catch {
        // ignore permission API failures and continue normally
      }
    }

    setCurrentLocationError(null);
    setLoadingCurrentLocation(true);

    let didComplete = false;
    const timeoutId = window.setTimeout(() => {
      if (!didComplete) {
        didComplete = true;
        setLoadingCurrentLocation(false);
        setCurrentLocationError('Location request timed out. Please allow access or try again.');
      }
    }, 15000);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (didComplete) return;
        didComplete = true;
        clearTimeout(timeoutId);

        try {
          const { latitude, longitude } = position.coords;
          const response = await apiRequest(`/weather/current?lat=${latitude}&lon=${longitude}&save=false`, { skipAuth: true });
          if (!response.ok) {
            throw new Error('Failed to load current location weather');
          }
          const data = await response.json();
          setCurrentLocationWeather(data);
        } catch (err) {
          setCurrentLocationError('Unable to retrieve current location weather.');
          console.error('Current location weather error:', err);
        } finally {
          setLoadingCurrentLocation(false);
        }
      },
      (positionError) => {
        if (didComplete) return;
        didComplete = true;
        clearTimeout(timeoutId);
        setLoadingCurrentLocation(false);
        if (positionError.code === positionError.PERMISSION_DENIED) {
          setCurrentLocationError('Location permission denied. Please allow access and try again.');
        } else {
          setCurrentLocationError('Unable to retrieve your location. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 600000 }
    );
  };

  const fetchForecastData = async (location, days = 5) => {
    setForecastError(null);
    setForecastLoading(true);

    try {
      let url;
      if (location && typeof location === 'object' && location.lat != null && location.lon != null) {
        url = `https://api.openweathermap.org/data/2.5/forecast?lat=${location.lat}&lon=${location.lon}&units=metric&appid=${API_KEY}`;
      } else if (location && typeof location === 'string') {
        url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&units=metric&appid=${API_KEY}`;
      } else if (weather?.coord?.lat != null && weather?.coord?.lon != null) {
        url = `https://api.openweathermap.org/data/2.5/forecast?lat=${weather.coord.lat}&lon=${weather.coord.lon}&units=metric&appid=${API_KEY}`;
      } else {
        throw new Error('No location available for forecast');
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Unable to load forecast data');
      }

      const data = await response.json();
      const grouped = {};
      data.list.forEach((entry) => {
        const dateKey = new Date(entry.dt * 1000).toISOString().split('T')[0];
        if (!grouped[dateKey]) {
          grouped[dateKey] = {
            date: dateKey,
            temps: [],
            conditions: [],
            icons: [],
            raw: [],
          };
        }
        grouped[dateKey].temps.push(entry.main.temp);
        grouped[dateKey].conditions.push(entry.weather[0]?.description || '');
        grouped[dateKey].icons.push(entry.weather[0]?.icon);
        grouped[dateKey].raw.push(entry);
      });

      const summary = Object.values(grouped)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, days)
        .map((day) => {
          const avgTemp = day.temps.reduce((sum, val) => sum + val, 0) / day.temps.length;
          const minTemp = Math.min(...day.temps);
          const maxTemp = Math.max(...day.temps);
          const condition = day.conditions[Math.floor(day.conditions.length / 2)] || '';
          const icon = day.icons[Math.floor(day.icons.length / 2)];
          return {
            date: day.date,
            displayDate: new Date(day.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
            avgTemp,
            minTemp,
            maxTemp,
            condition,
            icon,
            raw: day.raw,
          };
        });

      setForecastData(summary);
    } catch (err) {
      console.error('Forecast load error:', err);
      setForecastError('Failed to load forecast data.');
      setForecastData([]);
    } finally {
      setForecastLoading(false);
    }
  };

  const searchCities = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/weather/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Search results raw:', data);
        
        // Parse query for city and country
        const parts = query.split(',').map(s => s.trim().toLowerCase());
        const cityQuery = parts[0];
        const countryQuery = parts[1];
        
        // Only show main cities (no state) or exact matches
        const filtered = data
          .filter(result => !result.state || result.name.toLowerCase() === cityQuery)
          .sort((a, b) => {
            // Prioritize exact city name matches
            const aCityMatch = a.name.toLowerCase() === cityQuery ? 0 : 1;
            const bCityMatch = b.name.toLowerCase() === cityQuery ? 0 : 1;
            if (aCityMatch !== bCityMatch) return aCityMatch - bCityMatch;
            
            // Then prioritize country matches if country specified
            if (countryQuery) {
              const aCountryMatch = getCountryName(a.country).toLowerCase().includes(countryQuery) || a.country.toLowerCase() === countryQuery ? 0 : 1;
              const bCountryMatch = getCountryName(b.country).toLowerCase().includes(countryQuery) || b.country.toLowerCase() === countryQuery ? 0 : 1;
              console.log(`Sorting: ${a.name}, ${a.country} (${getCountryName(a.country)}) - match: ${aCountryMatch}`);
              console.log(`Sorting: ${b.name}, ${b.country} (${getCountryName(b.country)}) - match: ${bCountryMatch}`);
              return aCountryMatch - bCountryMatch;
            }
            
            return 0;
          })
          .slice(0, 5); // Limit to top 5 results
        
        console.log('Search results filtered and sorted:', filtered);
        setSearchResults(filtered);
        setShowSearchDropdown(true);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
      setShowSearchDropdown(false);
    }
  };

  const loadWeatherHistory = async (cityName) => {
    if (!token) return;
    
    try {
      const response = await apiRequest(`/weather/history?city=${encodeURIComponent(cityName)}`);
      if (response.ok) {
        const data = await response.json();
        setWeatherHistory(data);
      }
    } catch (error) {
      console.error('Failed to load weather history:', error);
    }
  };

  // Load user data on mount and token change
  useEffect(() => {
    if (token) {
      loadUserData();
    }

    if (token && profileOpen && profileSection === 'searches') {
      loadSearchesData();
    }

    if (token && profileOpen && profileSection === 'users') {
      loadUsersList();
    }
  }, [token, profileOpen, profileSection]);

  useEffect(() => {
    if (token && user && !currentLocationWeather && !loadingCurrentLocation) {
      loadCurrentLocationWeather();
    }
  }, [token, user, currentLocationWeather, loadingCurrentLocation]);

  useEffect(() => {
    if (conditionsTab === 'forecast') {
      const location = selectedLocation || (weather?.coord?.lat != null && weather?.coord?.lon != null ? { lat: weather.coord.lat, lon: weather.coord.lon } : null);
      if (location || city) {
        fetchForecastData(location || city, forecastDays);
      } else {
        setForecastError('Use the search panel to bring weather data into focus.');
        setForecastData([]);
      }
    }
  }, [conditionsTab, forecastDays, weather, selectedLocation, city]);

  useEffect(() => {
    if (conditionsTab === 'forecast' && !hasPermission(user, 'forecast')) {
      setConditionsTab('overview');
    }
  }, [conditionsTab, user]);

  // Load weather history when city changes
  useEffect(() => {
    if (token && displayCityName) {
      loadWeatherHistory(displayCityName);
    } else if (token && city) {
      loadWeatherHistory(city);
    }
  }, [displayCityName, city, token]);

  const fetchWeather = async (location, originalCityName = null) => {
    setLoading(true);
    setError(null);
    try {
      let endpoint;
      const hasCoordinates = location && typeof location === 'object' && location.lat != null && location.lon != null;
      if (hasCoordinates) {
        endpoint = `/weather/current?lat=${location.lat}&lon=${location.lon}`;
        if (originalCityName) {
          endpoint += `&cityname=${encodeURIComponent(originalCityName)}`;
        }
      } else {
        const cityName = typeof location === 'string' ? location.trim() : '';
        if (!cityName && location && typeof location === 'object' && location.name) {
          endpoint = `/weather/current/${encodeURIComponent(location.name)}`;
        } else {
          endpoint = `/weather/current/${encodeURIComponent(cityName)}`;
        }
      }
      console.log('Fetching:', endpoint);
      const response = await apiRequest(endpoint);
      const responseText = await response.text();
      console.log('Response status:', response.status, 'body:', responseText);
      if (!response.ok) {
        let message = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(responseText);
          if (errorData && errorData.message) {
            message = `${errorData.message} (${errorData.cod})`;
          }
        } catch (parseError) {
          // ignore parse errors
        }
        throw new Error(message);
      }
      const data = JSON.parse(responseText);
      console.log('Data:', data);
      setWeather(data);
      // Use the original city name from search result if available, otherwise use API response
      if (originalCityName) {
        setDisplayCityName(originalCityName);
      } else {
        setDisplayCityName(data.name);
      }

      if (token && profileOpen && profileSection === 'searches') {
        loadSearchesData();
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
      setWeather(null);
      setDisplayCityName(null);
    }
    setLoading(false);
  };

  const fetchWeatherByCity = async (cityName) => {
    if (!cityName || !cityName.trim()) return;

    const query = cityName.trim();
    const parts = query.split(',').map((part) => part.trim());
    const cityQuery = parts[0].toLowerCase();
    const countryQuery = parts[1]?.toLowerCase();

    try {
      const response = await fetch(`${API_BASE_URL}/weather/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error('City lookup failed');
      }

      const results = await response.json();
      let chosen = results.find((result) => {
        const sameCity = result.name.toLowerCase() === cityQuery;
        if (!sameCity) return false;
        if (!countryQuery) return true;
        return result.country.toLowerCase() === countryQuery || getCountryName(result.country).toLowerCase() === countryQuery;
      });

      if (!chosen && results.length > 0) {
        chosen = results[0];
      }

      if (chosen && chosen.lat != null && chosen.lon != null) {
        selectCity(chosen);
        return;
      }
    } catch (err) {
      console.error('fetchWeatherByCity error:', err);
    }

    fetchWeather(query);
  };

  const scrollToSection = (section) => {
    setActiveSection(section);
    const element = document.getElementById(section);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedCity = city.trim();
    if (!trimmedCity) {
      setError('Please enter a city name');
      return;
    }

    if (selectedLocation && trimmedCity.length > 0) {
      fetchWeather(selectedLocation, displayCityName || trimmedCity);
      return;
    }

    if (searchResults.length > 0) {
      selectCity(searchResults[0]);
      return;
    }

    await fetchWeatherByCity(trimmedCity);
  };

  return (
    <div className="App">
      <nav className="navbar">
        <div className="logo">Pay2Weather</div>
        <div className="auth-section">
          {user ? (
            <div className="user-menu">
              <div className="user-info">
                <span className="user-greeting">Hello, {user.username}</span>
                <span className="user-tier">{getDisplaySubscription()}</span>
              </div>
              <button
                type="button"
                className={profileOpen ? 'auth-btn profile-btn active' : 'auth-btn profile-btn'}
                onClick={() => {
                  const nextProfileOpen = !profileOpen;
                  setProfileOpen(nextProfileOpen);
                  if (nextProfileOpen) {
                    setProfileSection('account');
                    setSearchesView('top5');
                  }
                }}
              >
                {profileOpen ? 'Home' : 'Profile'}
              </button>
              <button type="button" className="auth-btn logout-btn" onClick={logout}>
                Logout
              </button>
            </div>
          ) : (
            <button type="button" className="auth-btn login-btn" onClick={() => {
              console.log('Login button clicked');
              setShowAuth(true);
            }}>
              Login
            </button>
          )}
        </div>
      </nav>

      <div className="app-layout">
        <aside className="sidebar">
          <section
            className={`panel search-panel ${profileOpen ? 'profile-active' : ''}`}
            id="search"
            onMouseEnter={() => setActiveSection('search')}
            onMouseLeave={() => setActiveSection('')}
          >
            {!profileOpen ? (
              <>
                <h2>Find weather quickly</h2>
                <p>Enter any city name to get live weather data.</p>
                <form onSubmit={handleSubmit} className="search-form">
                  <div className="search-input-container">
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setSelectedLocation(null);
                        searchCities(e.target.value);
                      }}
                      onFocus={() => city.length >= 2 && setShowSearchDropdown(true)}
                      onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                      placeholder="Zagreb"
                      className="city-input"
                    />
                    {showSearchDropdown && searchResults.length > 0 && (
                      <div className="search-dropdown">
                        {searchResults.map((result, index) => {
                          const countryName = getCountryName(result.country);
                          const fullCityName = `${result.name}, ${countryName}`;
                          return (
                          <div
                            key={index}
                            className="search-result-item"
                            onClick={() => selectCity(result)}
                          >
                            {result.name}, {result.state && `${result.state}, `}{result.country}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <button type="submit" className="search-btn">Search</button>
                  {user && weather && (
                    <button
                      type="button"
                      className="favorite-btn"
                      onClick={() => {
                        const favoriteItem = favorites.find(isFavoriteMatch);
                        if (favoriteItem) {
                          removeFavorite(favoriteItem.id);
                        } else {
                          const locationName = weather?.name && normalizeCity(weather.name) !== normalizeCity(getFavoriteCityName())
                            ? weather.name
                            : null;
                          addFavorite(getFavoriteCityName(), weather.sys.country, selectedLocation?.lat, selectedLocation?.lon, locationName);
                        }
                      }}
                    >
                      {favorites.some(isFavoriteMatch) ? '★' : '☆'}
                    </button>
                  )}
                </form>
                {error && <p className="error">{error}</p>}
              </>
            ) : (
              <>
                <div className={`profile-options profile-options--count-${canManageUsers() ? 3 : 2}`}>
                  <button
                    type="button"
                    className={profileSection === 'account' ? 'profile-tab active' : 'profile-tab'}
                    onClick={() => setProfileSection('account')}
                  >
                    Account
                  </button>
                  <button
                    type="button"
                    className={profileSection === 'searches' ? 'profile-tab active' : 'profile-tab'}
                    onClick={() => setProfileSection('searches')}
                  >
                    Searches
                  </button>
                  {canManageUsers() && (
                    <button
                      type="button"
                      className={profileSection === 'users' ? 'profile-tab active' : 'profile-tab'}
                      onClick={() => setProfileSection('users')}
                    >
                      Users
                    </button>
                  )}
                </div>
              </>
            )}
          </section>

          <section
            className={`panel quick-glance ${activeSection === 'quick-glance' ? 'active' : ''} ${!user ? 'unauthenticated' : ''}`}
            onMouseEnter={() => setActiveSection('quick-glance')}
            onMouseLeave={() => setActiveSection('')}
          >
            {user && <h3>Current Location</h3>}
            {!user ? (
              <div className="login-required-box">
                <div className="login-prompt">
                  <p className="login-message">Login to view current weather</p>
                  <button 
                    className="login-button"
                    onClick={() => setShowAuth(true)}
                  >
                    Login
                  </button>
                </div>
              </div>
            ) : currentLocationWeather ? (
              <div className="quick-grid">
                <div className="stat-card">
                  <span>Location</span>
                  <strong>{currentLocationWeather.name}</strong>
                  <p className="location-label">{getCountryName(currentLocationWeather.sys.country)}</p>
                </div>
                <div className="stat-card">
                  <span>Temperature</span>
                  <strong>{Math.round(currentLocationWeather.main.temp)}°C</strong>
                </div>
                <div className="stat-card">
                  <span>Condition</span>
                  <strong>{currentLocationWeather.weather[0].main}</strong>
                  <p className="description">{currentLocationWeather.weather[0].description}</p>
                </div>
              </div>
            ) : (
              <div className="quick-location-empty">
                <p>{loadingCurrentLocation ? 'Loading current location weather…' : currentLocationError || 'Current location data is unavailable.'}</p>
              </div>
            )}
          </section>
        </aside>

        <main className="main-panel" id="overview">
          <div
            className={activeSection === 'overview' ? 'weather-hero active' : 'weather-hero'}
            onMouseEnter={() => setActiveSection('overview')}
            onMouseLeave={() => setActiveSection('')}
          >
            {profileOpen ? (
              <div className="profile-hero">
                <div>
                  <p className="subtitle">Profile</p>
                  <h2>{profileSection === 'account' ? 'Account details' : profileSection === 'users' ? 'User management' : 'Searches'}</h2>
                </div>
              </div>
            ) : (
              <div className="hero-header">
                <div>
                  <p className="subtitle">Current conditions</p>
                  <h2>{weather ? getDisplayLocation() : 'Search for a city to display its weather'}</h2>
                  {weather && weather.name && displayCityName && normalizeCity(weather.name) !== normalizeCity(displayCityName) && (
                    <p style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>({weather.name})</p>
                  )}
                </div>
                <div className="conditions-tabs">
                  <button
                    type="button"
                    className={conditionsTab === 'overview' ? 'conditions-tab active' : 'conditions-tab'}
                    onClick={() => setConditionsTab('overview')}
                  >
                    Overview
                  </button>
                  {hasPermission(user, 'forecast') && (
                    <button
                      type="button"
                      className={conditionsTab === 'forecast' ? 'conditions-tab active' : 'conditions-tab'}
                      onClick={() => setConditionsTab('forecast')}
                    >
                      Forecast
                    </button>
                  )}
                </div>
              </div>
            )}

            {profileOpen && user ? (
              <div className="profile-content">
                {profileSection === 'account' ? (
                  <div className="profile-card">
                    <h3>Account details</h3>
                    <div className="profile-detail">
                      <span>Username</span>
                      <strong>{user.username}</strong>
                    </div>
                    <div className="profile-detail">
                      <span>Email</span>
                      <strong>{user.email || 'No email available'}</strong>
                    </div>
                  </div>
                ) : profileSection === 'users' ? (
                  <div className="profile-card">
                    <h3>User management</h3>
                    {usersLoading ? (
                      <p>Loading users...</p>
                    ) : usersError ? (
                      <p className="error">{usersError}</p>
                    ) : (
                      <>
                        {userManagementMessage && <p className="success-message">{userManagementMessage}</p>}
                        {usersList.length === 0 ? (
                          <p className="profile-placeholder">No users are available to manage.</p>
                        ) : (
                          <table className="profile-table">
                            <thead>
                              <tr>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Tier</th>
                                <th>Update</th>
                              </tr>
                            </thead>
                            <tbody>
                              {usersList.map((managedUser) => (
                                <tr key={managedUser.id}>
                                  <td>{managedUser.username}</td>
                                  <td>{managedUser.email || 'No email'}</td>
                                  <td>{formatSubscriptionLabel(managedUser.subscription)}</td>
                                  <td>
                                    <select
                                      className="profile-select"
                                      value={String(managedUser.subscription)}
                                      disabled={managedUser.id === user.id}
                                      onChange={(e) => updateUserSubscription(managedUser.id, e.target.value)}
                                    >
                                      <option value="1">TIER 1</option>
                                      <option value="2">TIER 2</option>
                                      <option value="3">TIER 3</option>
                                    </select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="profile-search-tabs">
                      <button
                        type="button"
                        className={searchesView === 'top5' ? 'profile-search-tab active' : 'profile-search-tab'}
                        onClick={() => setSearchesView('top5')}
                      >
                        Top searches
                      </button>
                      <button
                        type="button"
                        className={searchesView === 'recent' ? 'profile-search-tab active' : 'profile-search-tab'}
                        onClick={() => setSearchesView('recent')}
                      >
                        Recent searches
                      </button>
                      <button
                        type="button"
                        className={searchesView === 'history' ? 'profile-search-tab active' : 'profile-search-tab'}
                        onClick={() => setSearchesView('history')}
                      >
                        Conditions history
                      </button>
                    </div>
                    <div className="profile-card">
                      {searchesView === 'top5' && (
                        <div>
                          <h3>Top searches</h3>
                          {searchesLoading ? (
                            <p>Loading saved searches...</p>
                          ) : topSearchesError ? (
                            <p className="error">{topSearchesError}</p>
                          ) : topSearches.length === 0 ? (
                            <p className="profile-placeholder">No top searches found yet.</p>
                          ) : (
                            <table className="profile-table">
                              <thead>
                                <tr>
                                  <th>Location</th>
                                  <th>Searches</th>
                                  <th>Last searched</th>
                                </tr>
                              </thead>
                              <tbody>
                                {topSearches.map((item, index) => (
                                  <tr key={index}>
                                    <td>{item.cityName}</td>
                                    <td>{item.count}</td>
                                    <td>{formatDateTime(item.lastSearchedAt)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                      {searchesView === 'recent' && (
                        <div>
                          <h3>Recent searches</h3>
                          {searchesLoading ? (
                            <p>Loading saved searches...</p>
                          ) : recentSearchesError ? (
                            <p className="error">{recentSearchesError}</p>
                          ) : recentSearches.length === 0 ? (
                            <p className="profile-placeholder">No recent searches found yet.</p>
                          ) : (
                            <table className="profile-table">
                              <thead>
                                <tr>
                                  <th>Location</th>
                                  <th>Searched at</th>
                                </tr>
                              </thead>
                              <tbody>
                                {recentSearches.map((item, index) => (
                                  <tr key={index}>
                                    <td>{item.cityName}</td>
                                    <td>{formatDateTime(item.recordedAt)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                      {searchesView === 'history' && (
                        <>
                          <h3>Conditions history</h3>
                          {searchesLoading ? (
                            <p>Loading saved conditions...</p>
                          ) : conditionCountsError ? (
                            <p className="error">{conditionCountsError}</p>
                          ) : conditionCounts.length > 0 ? (
                            <table className="profile-table">
                              <thead>
                                <tr>
                                  <th>Condition</th>
                                  <th>Occurrences</th>
                                </tr>
                              </thead>
                              <tbody>
                                {conditionCounts.map((item, index) => (
                                  <tr key={index}>
                                    <td>{item.condition}</td>
                                    <td>{item.count}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="profile-placeholder">No condition history available yet.</p>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : conditionsTab === 'overview' ? (
              weather ? (
                <div className="weather-content">
                  <div className="weather-card">
                    <div className="weather-summary">
                      <i className={`wi ${getWeatherIconClass(weatherIconCode)} weather-icon`}></i>
                      <div>
                        <p className="temperature-large">{Math.round(weather.main.temp)}°C</p>
                        <p className="description">{weather.weather[0].description}</p>
                      </div>
                    </div>

                    <div className="details-grid" id="details">
                      <div className="detail-item">
                        <span>Feels like</span>
                        <strong>{Math.round(weather.main.feels_like)}°C</strong>
                      </div>
                      <div className="detail-item">
                        <span>Humidity</span>
                        <strong>{weather.main.humidity}%</strong>
                      </div>
                      <div className="detail-item">
                        <span>Wind speed</span>
                        <strong>{weather.wind.speed} m/s</strong>
                      </div>
                      <div className={`detail-item ${!advancedWeatherDetailsUnlocked() ? 'locked' : ''}`}>
                        <span>Pressure</span>
                        {advancedWeatherDetailsUnlocked() ? (
                          <strong>{weather.main.pressure} hPa</strong>
                        ) : (
                          <div className="locked-detail">
                            <strong>Locked</strong>
                            <p>Tier 2 required</p>
                          </div>
                        )}
                      </div>
                      <div className={`detail-item ${!advancedWeatherDetailsUnlocked() ? 'locked' : ''}`}>
                        <span>Visibility</span>
                        {advancedWeatherDetailsUnlocked() ? (
                          <strong>{weather.visibility ? `${weather.visibility / 1000} km` : '—'}</strong>
                        ) : (
                          <div className="locked-detail">
                            <strong>Locked</strong>
                            <p>Tier 2 required</p>
                          </div>
                        )}
                      </div>
                      <div className={`detail-item ${!advancedWeatherDetailsUnlocked() ? 'locked' : ''}`}>
                        <span>Sunrise</span>
                        {advancedWeatherDetailsUnlocked() ? (
                          <strong>{weather.sys?.sunrise ? new Date(weather.sys.sunrise * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</strong>
                        ) : (
                          <div className="locked-detail">
                            <strong>Locked</strong>
                            <p>Tier 2 required</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="hero-empty">
                  <p>Use the search panel to bring weather data into focus.</p>
                </div>
              )
            ) : (
              <div className="forecast-panel">
                <div className="forecast-controls">
                  <span>Period</span>
                  {[2, 4, 6].map((days) => (
                    <button
                      key={days}
                      type="button"
                      className={forecastDays === days ? 'forecast-day-btn active' : 'forecast-day-btn'}
                      onClick={() => setForecastDays(days)}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
                {forecastLoading ? (
                  <div className="forecast-empty">Loading forecast...</div>
                ) : forecastError ? (
                  <div className="hero-empty"><p>{forecastError}</p></div>
                ) : forecastData.length === 0 ? (
                  <p className="forecast-empty">No forecast data available.</p>
                ) : (
                  <>
                    <div className="forecast-grid">
                      {forecastData.map((day, index) => (
                        <div key={index} className="forecast-card">
                          <h4>{day.displayDate}</h4>
                          <p className="forecast-temp">{Math.round(day.avgTemp)}°C</p>
                          <p className="forecast-minmax">{Math.round(day.minTemp)}° / {Math.round(day.maxTemp)}°</p>
                          <p className="description">{day.condition}</p>
                        </div>
                      ))}
                    </div>

                    <div className="forecast-chart">
                      <h3>Temperature Trend</h3>
                      <div className="forecast-line-chart">
                        <svg viewBox="0 0 520 264" preserveAspectRatio="none" shapeRendering="geometricPrecision">
                          {forecastGridLines().map((line, index) => (
                            <g key={index}>
                              <line x1="40" y1={line.y} x2="480" y2={line.y} className="forecast-grid-line" />
                              <text x="8" y={line.y + 4} className="forecast-axis-label">{line.temp}°</text>
                            </g>
                          ))}
                          <line x1="40" y1="20" x2="40" y2="244" className="forecast-axis" />
                          <line x1="40" y1="244" x2="480" y2="244" className="forecast-axis" />
                          <path d={forecastLinePath()} className="forecast-line" />
                          {forecastData.map((day, index) => {
                            const pointCount = forecastData.length;
                            const pointMargin = 30;
                            const chartLeft = 40 + pointMargin;
                            const chartRight = 480 - pointMargin;
                            const chartWidth = chartRight - chartLeft;
                            const chartBottom = 244;
                            const chartTop = 20;
                            const chartHeight = chartBottom - chartTop;
                            const { minTemp, maxTemp } = forecastBounds();
                            const x = pointCount === 1
                              ? chartLeft + chartWidth / 2
                              : chartLeft + (index / (pointCount - 1)) * chartWidth;
                            const y = chartBottom - ((day.avgTemp - minTemp) / (maxTemp - minTemp || 1)) * chartHeight;
                            return (
                              <g key={index}>
                                <circle cx={x} cy={y} r="4" className="forecast-point" />
                                <text x={x} y={y - 8} className="forecast-point-label">{Math.round(day.avgTemp)}°</text>
                                <text x={x} y="260" className="forecast-point-label">{new Date(day.date).toLocaleDateString([], { weekday: 'short' })}</text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Authentication Modal */}
      {showAuth && (
        <div className="auth-modal-overlay" onClick={() => setShowAuth(false)}>
          {console.log('Rendering auth modal')}
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-tabs">
              <button
                type="button"
                className={authMode === 'login' ? 'auth-tab active' : 'auth-tab'}
                onClick={() => setAuthMode('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={authMode === 'register' ? 'auth-tab active' : 'auth-tab'}
                onClick={() => setAuthMode('register')}
              >
                Register
              </button>
            </div>
            
            {error && (
              <div className="auth-error">
                {error}
              </div>
            )}
            
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null); // Clear previous errors
                try {
                  if (authMode === 'login') {
                    await login(authForm.username, authForm.password);
                  } else {
                    await register(authForm.username, authForm.email, authForm.password);
                  }
                  setAuthForm({ username: '', email: '', password: '' }); // Clear form
                } catch (error) {
                  setError(error.message);
                }
              }}
              className="auth-form"
            >
              <input
                type="text"
                placeholder="Username"
                value={authForm.username}
                onChange={(e) => setAuthForm({...authForm, username: e.target.value})}
                required
              />
              {authMode === 'register' && (
                <input
                  type="email"
                  placeholder="Email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                  required
                />
              )}
              <input
                type="password"
                placeholder="Password"
                value={authForm.password}
                onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                required
              />
              <button type="submit" className="auth-submit-btn">
                {authMode === 'login' ? 'Login' : 'Register'}
              </button>
            </form>
            
            <button type="button" className="auth-close-btn" onClick={() => setShowAuth(false)}>
              ×
            </button>
          </div>
        </div>
      )}

      {/* Favorites Section */}
      {user && (
        <section
          className={activeSection === 'favorites' ? 'panel favorites-panel active' : 'panel favorites-panel'}
          id="favorites"
          onMouseEnter={() => setActiveSection('favorites')}
          onMouseLeave={() => setActiveSection('')}
        >
          <h2>Your Favorite Cities</h2>
          {favorites.length === 0 ? (
            <p>You haven't added any favorite cities yet. Search for a city and click the star to add it to favorites.</p>
          ) : (
            <div className="favorites-grid">
              {(favoriteLimit === Infinity ? favorites : favorites.slice(0, favoriteLimit)).map((fav, index) => {
                const favoriteCountryDisplay = getCountryName(fav.country);
                const favoriteCityDisplay = fav.cityName.includes(',')
                  ? fav.cityName
                  : fav.cityName;
                const favoriteLocation = fav.latitude != null && fav.longitude != null
                  ? { lat: fav.latitude, lon: fav.longitude }
                  : fav.cityName.includes(',')
                    ? fav.cityName
                    : `${fav.cityName}, ${favoriteCountryDisplay}`;
                const normalizedCity = normalizeCity(fav.cityName);
                const normalizedLocationName = fav.locationName ? normalizeCity(fav.locationName) : null;
                const showLocationName = fav.locationName && normalizedLocationName !== normalizedCity && normalizedLocationName !== normalizeCity(favoriteCountryDisplay);
                const showCountry = !fav.cityName.includes(',') || !fav.cityName.toLowerCase().includes(favoriteCountryDisplay.toLowerCase());

                return (
                  <div key={fav.id || index} className="favorite-card" onClick={() => {
                    if (fav.latitude != null && fav.longitude != null) {
                      setSelectedLocation({ lat: fav.latitude, lon: fav.longitude });
                      fetchWeather({ lat: fav.latitude, lon: fav.longitude }, fav.cityName);
                    } else {
                      setSelectedLocation(null);
                      const countryDisplay = getCountryName(fav.country);
                      fetchWeatherByCity(`${fav.cityName}, ${countryDisplay}`);
                    }
                    setCity(favoriteCityDisplay);
                  }}>
                    <h3>{fav.cityName}</h3>
                    {showLocationName && <p className="favorite-subtitle">({fav.locationName})</p>}
                    {showCountry && <p>{favoriteCountryDisplay}</p>}
                    <button
                      type="button"
                      className="remove-favorite-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFavorite(fav.id);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
              {favoriteLimit !== Infinity && favorites.length > favoriteLimit && (
                <div className="favorite-card favorite-locked-card">
                  <h3>Locked favorites</h3>
                  <p className="favorite-subtitle">{favoriteLockMessage()}</p>
                  <button
                    type="button"
                    className="remove-favorite-btn locked-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFavorite(favorites[favoriteLimit].id);
                    }}
                  >
                    Remove unknown favorite
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default App;