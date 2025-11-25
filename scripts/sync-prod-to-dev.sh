#!/bin/bash

# Exit on error
set -e

echo "Syncing production data to development..."

# Create a temporary directory for the export
TEMP_DIR=$(mktemp -d)
EXPORT_FILE="$TEMP_DIR/snapshot.zip"

echo "Exporting data from production..."
npx convex export --prod --path "$EXPORT_FILE"

echo "Importing data to development (replacing existing data)..."
# Using --replace-all to clear tables not in the import and replace data in existing tables
npx convex import --replace-all "$EXPORT_FILE" --yes

# Cleanup
rm -rf "$TEMP_DIR"

echo "Sync complete!"
