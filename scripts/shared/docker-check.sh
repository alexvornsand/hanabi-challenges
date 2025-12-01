#!/usr/bin/env bash
set -e

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ docker CLI not found. Install Docker Desktop or Docker Engine first."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker is installed but not running."
  echo "   Please start Docker Desktop (macOS/Windows) or the Docker daemon (Linux),"
  echo "   then re-run this command."
  exit 1
fi

echo "✅ Docker is running."
