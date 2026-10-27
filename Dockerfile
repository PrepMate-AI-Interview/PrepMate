# Stage 1: Build .NET Backend & Bundle FE
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project file and restore
COPY BE/backend.csproj BE/
RUN dotnet restore BE/backend.csproj

# Copy full source
COPY BE/ BE/
COPY FE/ FE/

# Publish release bundle
RUN dotnet publish BE/backend.csproj -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime Environment
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production
ENV DATABASE_FILE_PATH=/app/data/db.json
ENV PREPMATE_KEYRING_PATH=/app/keys

COPY --from=build /app/publish .

# Ensure data and keys directories exist
RUN mkdir -p /app/data /app/keys

VOLUME ["/app/data", "/app/keys"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["dotnet", "backend.dll"]
