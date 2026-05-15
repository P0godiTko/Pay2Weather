FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["WeatherBackend.csproj", "./"]
RUN dotnet restore "WeatherBackend.csproj"

COPY . .
RUN dotnet publish "WeatherBackend.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:80
ENTRYPOINT ["dotnet", "WeatherBackend.dll"]
