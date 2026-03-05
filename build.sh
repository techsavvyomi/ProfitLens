#!/bin/bash
# Build script: generates js/config.js from .env and js/config.example.js
# Run: bash build.sh

if [ ! -f .env ]; then
  echo "Error: .env file not found. Create one from .env.example"
  exit 1
fi

# Load .env
export $(grep -v '^#' .env | xargs)

# Generate config.js from template
sed "s|__WEBAPP_URL__|${WEBAPP_URL}|g" js/config.example.js > js/config.js

echo "Generated js/config.js from .env"
