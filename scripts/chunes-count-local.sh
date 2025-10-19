#!/bin/bash

# === CONFIGURATION ===
FOLDER_PATH="$HOME/Desktop/chunes"

# === EXECUTION ===
if [ ! -d "$FOLDER_PATH" ]; then
  echo "❌ Error: '$FOLDER_PATH' does not exist."
  exit 1
fi

# Count files recursively
COUNT=$(find "$FOLDER_PATH" -type f | wc -l)

echo "📁 Folder: $FOLDER_PATH"
echo "📊 Total files: $COUNT"