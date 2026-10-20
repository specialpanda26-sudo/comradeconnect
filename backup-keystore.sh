#!/bin/bash
KEYSTORE_FILE="$HOME/comrade-release.jks"
BACKUP_DIR="/sdcard/Download"

echo "=== Backing up Comrade Connect Keystore ==="

if [ -f "$KEYSTORE_FILE" ]; then
    mkdir -p "$BACKUP_DIR"
    cp "$KEYSTORE_FILE" "$BACKUP_DIR/comrade-release.jks"
    echo "Success! Keystore safely copied to:"
    echo "$BACKUP_DIR/comrade-release.jks"
    echo "You can now find it inside your phone's Downloads folder."
else
    echo "Error: Keystore file not found at $KEYSTORE_FILE."
    echo "Make sure you generated it first using the setup script."
fi
