#!/bin/bash
set -e

# Configuration
REPO="xyz327/jump-forward"
APP_NAME="Jump Forward"
# The name of the app bundle inside the DMG
APP_BUNDLE_SOURCE="jump-forward.app"
# The name of the app bundle to install in /Applications
APP_BUNDLE_TARGET="Jump Forward.app"
INSTALL_DIR="/Applications"

echo "🚀 Installing $APP_NAME..."

# 1. Get Latest Release Info
echo "🔍 Checking for latest release..."
# Fetch the latest release data from GitHub API
LATEST_RELEASE_DATA=$(curl -s "https://api.github.com/repos/$REPO/releases/latest")

# Detect Architecture
ARCH_TYPE=$(uname -m)
if [ "$ARCH_TYPE" == "arm64" ]; then
    ARCH_NAME="arm64"
else
    ARCH_NAME="amd64"
fi

echo "💻 Detected architecture: $ARCH_TYPE ($ARCH_NAME)"

# Extract the browser_download_url for the .dmg file
# Try to find one with the matching architecture
DOWNLOAD_URL=$(echo "$LATEST_RELEASE_DATA" | grep "browser_download_url" | grep ".dmg" | grep "$ARCH_NAME" | cut -d '"' -f 4 | head -n 1)

# If not found, try universal
if [ -z "$DOWNLOAD_URL" ]; then
    DOWNLOAD_URL=$(echo "$LATEST_RELEASE_DATA" | grep "browser_download_url" | grep ".dmg" | grep "universal" | cut -d '"' -f 4 | head -n 1)
fi

# Fallback to any DMG if no architecture-specific one is found
if [ -z "$DOWNLOAD_URL" ]; then
    DOWNLOAD_URL=$(echo "$LATEST_RELEASE_DATA" | grep "browser_download_url" | grep ".dmg" | cut -d '"' -f 4 | head -n 1)
fi

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
# Try to attach and capture output. We use -plist to get structured output which is more reliable
# but for simplicity in bash without external tools (like plutil), we'll stick to text parsing but make it robust.

# First attempt: Standard attach
MOUNT_OUTPUT=$(hdiutil attach "$DMG_PATH" -nobrowse -noverify 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "❌ Error: hdiutil attach failed with code $EXIT_CODE"
    echo "Output: $MOUNT_OUTPUT"
    
    # Check if "Resource busy" - might be already mounted
    if [[ "$MOUNT_OUTPUT" == *"Resource busy"* ]]; then
        echo "⚠️  DMG might already be mounted. Attempting to detach all and retry..."
        hdiutil detach "$DMG_PATH" -force 2>/dev/null || true
        # Retry once
        MOUNT_OUTPUT=$(hdiutil attach "$DMG_PATH" -nobrowse -noverify 2>&1)
    fi
fi

# Extract mount point. 
# Typical output from hdiutil attach:
# /dev/disk4s1            Apple_HFS                       /Volumes/jump-forward 6
# We need to capture everything after the last tab character that starts with /Volumes
MOUNT_POINT=$(echo "$MOUNT_OUTPUT" | grep "/Volumes" | awk -F'\t+' '{print $NF}' | head -n 1)

# Verify mount point
if [ -z "$MOUNT_POINT" ] || [ ! -d "$MOUNT_POINT" ]; then
    echo "❌ Error: Could not determine mount point."
    echo "Full hdiutil output:"
    echo "$MOUNT_OUTPUT"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "✅ Mounted at: $MOUNT_POINT"

# 4. Install Application
echo "📦 Installing to $INSTALL_DIR..."

# Check if the app bundle exists in the mounted volume
if [ ! -d "$MOUNT_POINT/$APP_BUNDLE_SOURCE" ]; then
    echo "⚠️  App bundle '$APP_BUNDLE_SOURCE' not found in root of DMG."
    echo "   Searching recursively..."
    FOUND_APP=$(find "$MOUNT_POINT" -name "$APP_BUNDLE_SOURCE" -maxdepth 2 | head -n 1)
    
    if [ -z "$FOUND_APP" ]; then
        echo "❌ Error: Could not find '$APP_BUNDLE_SOURCE' inside the DMG."
        hdiutil detach "$MOUNT_POINT" -quiet
        rm -rf "$TEMP_DIR"
        exit 1
    fi
    SOURCE_APP="$FOUND_APP"
else
    SOURCE_APP="$MOUNT_POINT/$APP_BUNDLE_SOURCE"
fi

echo "🔑 Authentication required to install application..."

# Construct the installation command sequence
# 1. Remove existing app (if any)
# 2. Copy new app to /Applications
# 3. Remove quarantine attributes
# We need to be very careful with AppleScript quoting. 
# We'll use single quotes for the shell command inside AppleScript, and escape inner single quotes if any.
# Since our paths might contain spaces (Jump Forward.app), we must quote them in the shell command.

# Prepare paths for shell command
TARGET_PATH="$INSTALL_DIR/$APP_BUNDLE_TARGET"
SOURCE_PATH="$SOURCE_APP"

# Construct the shell command string
# We use single quotes for the shell command inside AppleScript to avoid complex escaping of double quotes.
# But paths themselves are double quoted in the shell command to handle spaces.
# To make this robust, we will construct the entire AppleScript command string carefully.

# Target and Source paths are already set.
# We need to escape double quotes in the paths themselves if any (unlikely for standard paths but good practice)
TARGET_PATH_ESC=$(echo "$TARGET_PATH" | sed 's/"/\\"/g')
SOURCE_PATH_ESC=$(echo "$SOURCE_PATH" | sed 's/"/\\"/g')

# The shell command we want to run is:
# rm -rf "TARGET"; cp -R "SOURCE" "TARGET"; xattr -cr "TARGET"

# AppleScript: do shell script "..." with administrator privileges
# Inside the "...", we need to escape backslashes and double quotes.

SHELL_CMD="rm -rf \\\"$TARGET_PATH_ESC\\\"; cp -R \\\"$SOURCE_PATH_ESC\\\" \\\"$TARGET_PATH_ESC\\\"; xattr -cr \\\"$TARGET_PATH_ESC\\\""

# Debug info
# echo "DEBUG: AppleScript command content: $SHELL_CMD"

if ! osascript -e "do shell script \"$SHELL_CMD\" with administrator privileges"; then
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
echo "   Run open \"$INSTALL_DIR/$APP_BUNDLE_TARGET\" to start."
