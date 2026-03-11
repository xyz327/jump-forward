#!/bin/bash
set -e

APP_NAME=$1
BIN_DIR=$2
ARCH=$3

if [ -z "$ARCH" ]; then
    ARCH=$(uname -m)
    # Map arm64 to arm64 and x86_64 to amd64 for consistency
    if [ "$ARCH" == "x86_64" ]; then
        ARCH="amd64"
    fi
fi

DMG_NAME="${APP_NAME}-${ARCH}.dmg"
DMG_PATH="${BIN_DIR}/${DMG_NAME}"
STAGING_DIR="${BIN_DIR}/dmg_staging_${ARCH}"

# Clean up previous staging
rm -rf "${STAGING_DIR}"
mkdir -p "${STAGING_DIR}"

# Copy the app bundle
cp -R "${BIN_DIR}/${APP_NAME}.app" "${STAGING_DIR}/"

# Create symlink to /Applications
ln -s /Applications "${STAGING_DIR}/Applications"

# Create the DMG
hdiutil create -volname "${APP_NAME}" -srcfolder "${STAGING_DIR}" -ov -format UDZO "${DMG_PATH}"

# Clean up
rm -rf "${STAGING_DIR}"

echo "DMG created at ${DMG_PATH}"
