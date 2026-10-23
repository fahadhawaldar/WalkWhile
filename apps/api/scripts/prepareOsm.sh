#!/usr/bin/env bash
# Downloads the latest OpenStreetMap extract, cuts out the Dubai area and
# builds the pedestrian graph used by the OSM routing provider.
# Requires osmium-tool (brew install osmium-tool).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RAW="$ROOT/data/raw"
OUT="$ROOT/data/graphs"
SOURCE_URL="https://download.geofabrik.de/asia/gcc-states-latest.osm.pbf"
# Dubai emirate (lon_min,lat_min,lon_max,lat_max)
BBOX="54.88,24.78,55.68,25.37"

mkdir -p "$RAW" "$OUT"

if [[ "${SKIP_DOWNLOAD:-0}" != "1" ]]; then
  curl -L --fail -A "WalkWhile/0.1" -o "$RAW/gcc-states-latest.osm.pbf" "$SOURCE_URL"
fi

osmium extract -b "$BBOX" --strategy=complete_ways \
  "$RAW/gcc-states-latest.osm.pbf" -o "$RAW/dubai.osm.pbf" --overwrite
osmium tags-filter "$RAW/dubai.osm.pbf" w/highway \
  -o "$RAW/dubai-highways.osm.pbf" --overwrite
osmium add-locations-to-ways "$RAW/dubai-highways.osm.pbf" \
  -f opl -o "$RAW/dubai-highways.opl" --overwrite

npx tsx "$ROOT/apps/api/scripts/buildGraph.ts" \
  "$RAW/dubai-highways.opl" "$OUT/dubai.graph" \
  "OpenStreetMap contributors (Geofabrik GCC extract)"
