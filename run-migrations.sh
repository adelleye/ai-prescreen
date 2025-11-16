#!/bin/bash
set -e

cd apps/api

# Get DATABASE_URL from .env
export $(grep DATABASE_URL .env | xargs)

for file in migrations/*.sql; do
  if [ -f "$file" ]; then
    echo "Running $file..."
    # Extract UP migration (before -- DOWN)
    awk '/^-- DOWN/{ exit } { print }' "$file" | psql "$DATABASE_URL" 2>&1 | grep -v "^$" || true
  fi
done

echo "Migrations complete!"
