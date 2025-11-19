#!/bin/bash

echo "Rebuilding schema..."
docker exec -i hanabi_db psql -U hanabi_user -d hanabi_dev < db/schema.sql

echo "Loading sample data..."
docker exec -i hanabi_db psql -U hanabi_user -d hanabi_dev < db/sample_data.sql

echo "Done!"
