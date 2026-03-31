#!/bin/bash
# Download official artwork for Pokemon 1-649 (Gen 1-5)
# Source: PokeAPI sprites GitHub repo

DIR="$(cd "$(dirname "$0")/.." && pwd)/public/images/pokemon"
mkdir -p "$DIR"

BASE="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork"

echo "Downloading 649 Pokemon sprites to $DIR..."

# Use parallel downloads (10 at a time)
for id in $(seq 1 649); do
  if [ -f "$DIR/$id.png" ]; then
    continue
  fi
  echo "$BASE/$id.png $DIR/$id.png"
done | xargs -P 10 -L 1 bash -c 'curl -sL "$0" -o "$1"'

# Count downloaded
count=$(ls "$DIR"/*.png 2>/dev/null | wc -l)
echo "Done! $count sprites downloaded."
