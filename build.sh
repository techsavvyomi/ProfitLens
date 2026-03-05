#!/bin/bash
# Build script: generates js/config.js from .env and js/config.example.js
# Supports both .env file (local dev) and environment variables (Render, CI)
# Run: bash build.sh

# Load .env if it exists (local dev)
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check that WEBAPP_URL is set (from .env or environment)
if [ -z "$WEBAPP_URL" ]; then
  echo "Error: WEBAPP_URL is not set. Either create a .env file or set it as an environment variable."
  exit 1
fi

# Generate config.js from template
sed "s|__WEBAPP_URL__|${WEBAPP_URL}|g" js/config.example.js > js/config.js

echo "Generated js/config.js successfully"
