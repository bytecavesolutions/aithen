# Docker Registry Authentication Troubleshooting Guide

## Error: "Missing service parameter"

### Problem
```
ERROR: failed to push registry1.ved.yt/haldiram-matra/darpan-core-backend:latest:
failed to authorize: failed to fetch oauth token: unknown: Missing service parameter
```

This error occurs when a Docker registry is configured with token-based authentication but the `REGISTRY_AUTH_TOKEN_SERVICE` environment variable is not set.

---

## Root Cause

Docker Registry v2 uses OAuth 2.0 token authentication. When a client attempts to push/pull without credentials, the registry returns a `WWW-Authenticate` header like:

```
WWW-Authenticate: Bearer realm="<auth-endpoint>",service="<service-name>",scope="<scope>"
```

The **service** parameter is REQUIRED for the OAuth token flow. Without `REGISTRY_AUTH_TOKEN_SERVICE` configured, the registry cannot populate this parameter, causing authentication to fail.

---

## Solution

### For Self-Hosted Registry (registry1.ved.yt)

If you're running your own Docker registry, you need to configure these environment variables:

#### Required Environment Variables

```yaml
environment:
  # Authentication Configuration
  REGISTRY_AUTH_TOKEN_REALM: https://your-auth-service.com/api/registry/token
  REGISTRY_AUTH_TOKEN_SERVICE: your-registry-service-name  # ← THIS IS CRITICAL
  REGISTRY_AUTH_TOKEN_ISSUER: your-auth-issuer-name
  REGISTRY_AUTH_TOKEN_ROOTCERTBUNDLE: /certs/registry.crt

  # HTTP Configuration
  REGISTRY_HTTP_ADDR: :5000
  REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY: /var/lib/registry
```

#### Example docker-compose.yml Configuration

```yaml
services:
  registry:
    image: registry:3
    container_name: custom-registry
    ports:
      - "5000:5000"
    volumes:
      - registry_data:/var/lib/registry
      - ./certs:/certs:ro
    environment:
      # Core Settings
      REGISTRY_HTTP_ADDR: :5000
      REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY: /var/lib/registry

      # Token Authentication - ALL THREE ARE REQUIRED
      REGISTRY_AUTH_TOKEN_REALM: https://registry1.ved.yt/api/registry/token
      REGISTRY_AUTH_TOKEN_SERVICE: haldiram-matra-registry  # Service identifier
      REGISTRY_AUTH_TOKEN_ISSUER: haldiram-auth             # Token issuer
      REGISTRY_AUTH_TOKEN_ROOTCERTBUNDLE: /certs/registry.crt

      # CORS and Headers
      REGISTRY_HTTP_HEADERS_Access-Control-Allow-Origin: "['*']"
      REGISTRY_HTTP_HEADERS_Access-Control-Allow-Methods: "['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS']"

volumes:
  registry_data:
```

---

## GitHub Actions Configuration

### Option 1: Using docker/login-action (Recommended)

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main]

jobs:
  build-and-push:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Custom Registry
        uses: docker/login-action@v3
        with:
          registry: registry1.ved.yt
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: registry1.ved.yt/haldiram-matra/darpan-core-backend:latest
```

### Option 2: Manual Docker Login

```yaml
      - name: Log in to Custom Registry
        run: |
          echo "${{ secrets.REGISTRY_PASSWORD }}" | docker login registry1.ved.yt \
            -u "${{ secrets.REGISTRY_USERNAME }}" \
            --password-stdin

      - name: Build and push
        run: |
          docker build -t registry1.ved.yt/haldiram-matra/darpan-core-backend:latest .
          docker push registry1.ved.yt/haldiram-matra/darpan-core-backend:latest
```

---

## Required GitHub Secrets

Add these secrets to your repository settings:

1. **REGISTRY_USERNAME**: Your registry username
2. **REGISTRY_PASSWORD**: Your registry password or token

To add secrets:
1. Go to your repository on GitHub
2. Click Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add both secrets

---

## Verification Steps

### 1. Check Registry Configuration

Test if your registry is properly configured:

```bash
# Test the /v2/ endpoint
curl -i https://registry1.ved.yt/v2/

# Should return 401 with WWW-Authenticate header containing "service" parameter
# Expected response:
# HTTP/1.1 401 Unauthorized
# WWW-Authenticate: Bearer realm="https://registry1.ved.yt/api/registry/token",service="your-service-name"
```

### 2. Manual Login Test

Try logging in manually:

```bash
docker login registry1.ved.yt
# Enter username and password
# Should succeed if credentials are correct
```

### 3. Test Push

```bash
docker tag your-image:latest registry1.ved.yt/haldiram-matra/darpan-core-backend:latest
docker push registry1.ved.yt/haldiram-matra/darpan-core-backend:latest
```

---

## Common Issues & Fixes

### Issue 1: Still Getting "Missing service parameter"
**Fix**: Restart the registry container after adding environment variables
```bash
docker-compose down
docker-compose up -d registry
```

### Issue 2: "x509: certificate signed by unknown authority"
**Fix**: The registry's TLS certificate is not trusted
```bash
# For testing only - add insecure registry
# /etc/docker/daemon.json
{
  "insecure-registries": ["registry1.ved.yt"]
}

# Then restart Docker
sudo systemctl restart docker
```

### Issue 3: Authentication token expired
**Fix**: Increase token expiry time
```yaml
environment:
  REGISTRY_TOKEN_EXPIRY: 600  # 10 minutes
```

### Issue 4: Wrong credentials
**Fix**: Verify your credentials are correct and have push permissions

---

## Complete Working Example

Here's a complete working setup based on this repository's configuration:

### docker-compose.yml
```yaml
services:
  registry:
    image: registry:3
    restart: unless-stopped
    ports:
      - "5000:5000"
    volumes:
      - registry_data:/var/lib/registry
      - ./certs:/certs:ro
    environment:
      REGISTRY_LOG_LEVEL: info
      REGISTRY_HTTP_ADDR: :5000
      REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY: /var/lib/registry
      REGISTRY_STORAGE_DELETE_ENABLED: "true"

      # TOKEN AUTH - REQUIRED
      REGISTRY_AUTH_TOKEN_REALM: https://registry1.ved.yt/api/registry/token
      REGISTRY_AUTH_TOKEN_SERVICE: haldiram-matra-registry
      REGISTRY_AUTH_TOKEN_ISSUER: haldiram-auth
      REGISTRY_AUTH_TOKEN_ROOTCERTBUNDLE: /certs/registry.crt

      # CORS
      REGISTRY_HTTP_HEADERS_Access-Control-Allow-Origin: "['*']"
      REGISTRY_HTTP_HEADERS_Access-Control-Allow-Methods: "['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS']"

volumes:
  registry_data:
```

### .github/workflows/docker-push.yml
```yaml
name: Build and Push to Custom Registry

on:
  push:
    branches: [main, develop]
  tags:
    - 'v*'

env:
  REGISTRY: registry1.ved.yt
  IMAGE_NAME: haldiram-matra/darpan-core-backend

jobs:
  build-and-push:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

## Quick Fix Checklist

- [ ] Verify `REGISTRY_AUTH_TOKEN_SERVICE` is set in registry configuration
- [ ] Verify `REGISTRY_AUTH_TOKEN_ISSUER` is set in registry configuration
- [ ] Verify `REGISTRY_AUTH_TOKEN_REALM` points to valid token endpoint
- [ ] Restart registry after configuration changes
- [ ] Add `REGISTRY_USERNAME` and `REGISTRY_PASSWORD` secrets to GitHub
- [ ] Update GitHub Actions workflow to use `docker/login-action@v3`
- [ ] Test manual `docker login` to verify credentials
- [ ] Check registry logs for detailed error messages

---

## Additional Resources

- [Docker Registry Token Authentication Spec](https://docs.docker.com/registry/spec/auth/token/)
- [Docker Registry Configuration Reference](https://docs.docker.com/registry/configuration/)
- [GitHub Actions docker/login-action](https://github.com/docker/login-action)
- [GitHub Actions docker/build-push-action](https://github.com/docker/build-push-action)

---

## Need Help?

If you're still experiencing issues after following this guide:

1. Check registry container logs: `docker logs <registry-container>`
2. Test the WWW-Authenticate header: `curl -i https://registry1.ved.yt/v2/`
3. Verify your token endpoint is accessible: `curl https://registry1.ved.yt/api/registry/token`
4. Check GitHub Actions logs for detailed error messages
