#!/bin/bash
# Quick database setup script

set -e

echo "🗄️  Setting up PostgreSQL database for testing...\n"

# Check if Docker is available
if command -v docker &> /dev/null; then
  echo "✅ Docker found - using Docker PostgreSQL\n"
  
  # Check if container already exists
  if docker ps -a | grep -q "ai-prescreen-db"; then
    echo "📦 Existing container found, starting it..."
    docker start ai-prescreen-db
  else
    echo "📦 Creating new PostgreSQL container..."
    docker run -d \
      --name ai-prescreen-db \
      -e POSTGRES_PASSWORD=testpassword \
      -e POSTGRES_USER=testuser \
      -e POSTGRES_DB=ai_prescreen \
      -p 5432:5432 \
      postgres:16-alpine
    
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 5
    
    # Wait for PostgreSQL to be actually ready
    for i in {1..30}; do
      if docker exec ai-prescreen-db pg_isready -U testuser > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!"
        break
      fi
      echo "   Waiting... ($i/30)"
      sleep 1
    done
  fi
  
  DATABASE_URL="postgres://testuser:testpassword@localhost:5432/ai_prescreen"
  
  echo "\n✅ Database container is running!"
  echo "📝 Add this to your apps/api/.env file:"
  echo "   DATABASE_URL=$DATABASE_URL\n"
  
  # Update .env file if it exists
  if [ -f "apps/api/.env" ]; then
    if grep -q "DATABASE_URL=" apps/api/.env; then
      # Update existing DATABASE_URL
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" apps/api/.env
      else
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" apps/api/.env
      fi
      echo "✅ Updated DATABASE_URL in apps/api/.env"
    else
      echo "DATABASE_URL=$DATABASE_URL" >> apps/api/.env
      echo "✅ Added DATABASE_URL to apps/api/.env"
    fi
  else
    echo "⚠️  apps/api/.env not found - please create it and add DATABASE_URL"
  fi
  
  echo "\n📋 Useful commands:"
  echo "   Stop database: docker stop ai-prescreen-db"
  echo "   Start database: docker start ai-prescreen-db"
  echo "   Remove database: docker rm -f ai-prescreen-db"
  echo "   View logs: docker logs ai-prescreen-db"
  
elif command -v brew &> /dev/null; then
  echo "🍺 Homebrew found - you can install PostgreSQL locally:\n"
  echo "   brew install postgresql@16"
  echo "   brew services start postgresql@16"
  echo "   createdb ai_prescreen"
  echo "\n   Then use: DATABASE_URL=postgres://$(whoami)@localhost:5432/ai_prescreen"
  echo "\n   Or use Docker (recommended for testing):"
  echo "   brew install --cask docker"
  echo "   Then run this script again"
  
else
  echo "❌ Neither Docker nor Homebrew found.\n"
  echo "📦 Options to get PostgreSQL:"
  echo "   1. Install Docker Desktop: https://www.docker.com/products/docker-desktop"
  echo "   2. Install PostgreSQL locally: https://www.postgresql.org/download/"
  echo "   3. Use a cloud service (free tier):"
  echo "      - Neon: https://neon.tech (free tier)"
  echo "      - Supabase: https://supabase.com (free tier)"
  echo "      - Railway: https://railway.app (free tier)"
  exit 1
fi










