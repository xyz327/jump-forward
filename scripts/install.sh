#!/bin/bash
set -e

# Configuration
REPO="xyz327/jump-forward"
APP_NAME="Jump Forward"
APP_BUNDLE="Jump Forward.app"
INSTALL_DIR="/Applications"

echo "🚀 Installing $APP_NAME..."

# 1. Get Latest Release Info
echo "🔍 Checking for latest release..."
# Fetch the latest release data from GitHub API
LATEST_RELEASE_DATA=$(curl -s "https://api.github.com/repos/$REPO/releases/latest")

# Extract the browser_download_url for the .dmg file
# This assumes there is only one .dmg file in the release assets, which is typical for macOS apps
DOWNLOAD_URL=$(echo "$LATEST_RELEASE_DATA" | grep "browser_download_url" | grep ".dmg" | cut -d '"' -f 4 | head -n 1)

if [ -z "$DOWNLOAD_URL" ]; then
    echo "❌ Error: Could not find a DMG download URL for the latest release."
    echo "Please check the releases page manually: https://github.com/$REPO/releases"
    exit 1
fi

echo "⬇️ Downloading from: $DOWNLOAD_URL"

# 2. Download DMG
TEMP_DIR=$(mktemp -d)
DMG_PATH="$TEMP_DIR/installer.dmg"
# curl -L follows redirects, -o output file, --progress-bar shows progress
curl -L "$DOWNLOAD_URL" -o "$DMG_PATH" --progress-bar

# 3. Mount DMG
echo "💿 Mounting DMG..."
# Use hdiutil attach and parse output to get the mount point
MOUNT_OUTPUT=$(hdiutil attach "$DMG_PATH" -nobrowse -quiet)
# The mount point is typically the last part of the output. 
# We need to handle potential spaces in mount points, although for this DMG it's likely simple.
# The output format of hdiutil attach is usually: /dev/diskXsY <tab> Apple_HFS <tab> /Volumes/MountPoint
MOUNT_POINT=$(echo "$MOUNT_OUTPUT" | grep "/Volumes" | awk -F'\t' '{print $NF}')

# Trim whitespace
MOUNT_POINT=$(echo "$MOUNT_POINT" | xargs)

if [ -z "$MOUNT_POINT" ]; then
    echo "❌ Error: Failed to mount DMG."
    rm -rf "$TEMP_DIR"
    exit 1
fi

# 4. Install Application
echo "📦 Installing to $INSTALL_DIR..."

# Check if the app bundle exists in the mounted volume
if [ ! -d "$MOUNT_POINT/$APP_BUNDLE" ]; then
    echo "❌ Error: App bundle '$APP_BUNDLE' not found in DMG at $MOUNT_POINT."
    hdiutil detach "$MOUNT_POINT" -quiet
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "🔑 Authentication required to install application..."

# Construct the installation command sequence
# 1. Remove existing app (if any)
# 2. Copy new app to /Applications
# 3. Remove quarantine attributes
INSTALL_SCRIPT="rm -rf \"$INSTALL_DIR/$APP_BUNDLE\"; cp -R \"$MOUNT_POINT/$APP_BUNDLE\" \"$INSTALL_DIR/\"; xattr -cr \"$INSTALL_DIR/$APP_BUNDLE\""

# Execute via AppleScript to prompt for GUI password
if ! osascript -e "do shell script \"$INSTALL_SCRIPT\" with administrator privileges"; then
    echo "❌ Installation cancelled or failed."
    hdiutil detach "$MOUNT_POINT" -quiet
    rm -rf "$TEMP_DIR"
    exit 1
fi

# 6. Cleanup
echo "🧹 Cleaning up..."
# Detach the DMG volume
hdiutil detach "$MOUNT_POINT" -quiet
# Remove temporary directory
rm -rf "$TEMP_DIR"

echo "✅ Installation complete! You can find $APP_NAME in your Applications folder."
echo "   Run open \"$INSTALL_DIR/$APP_BUNDLE\" to start."
