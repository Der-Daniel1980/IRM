#!/bin/bash
# ═══════════════════════════════════════════════════════
# IRM Mobile App — Android APK Build Script
# ═══════════════════════════════════════════════════════
#
# Voraussetzungen:
#   - Java 17 (openjdk-17-jdk)
#   - Android SDK (oder Android Studio installiert)
#   - Node.js 20+
#   - Min. 8 GB RAM empfohlen
#
# Verwendung:
#   cd packages/mobile
#   chmod +x BUILD-APK.sh
#   ./BUILD-APK.sh
#
# ═══════════════════════════════════════════════════════

set -e

echo "══════════════════════════════════════════"
echo " IRM Mobile — Android APK Build"
echo "══════════════════════════════════════════"

# 1. Java prüfen
if ! command -v java &> /dev/null; then
    echo "❌ Java nicht gefunden. Bitte installieren:"
    echo "   sudo apt install openjdk-17-jdk-headless"
    exit 1
fi
echo "✅ Java: $(java -version 2>&1 | head -1)"

# 2. Android SDK prüfen/setzen
if [ -z "$ANDROID_HOME" ]; then
    if [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
    elif [ -d "$HOME/android-sdk" ]; then
        export ANDROID_HOME="$HOME/android-sdk"
    else
        echo "❌ ANDROID_HOME nicht gesetzt und kein Android SDK gefunden."
        echo "   Bitte Android Studio installieren oder ANDROID_HOME setzen."
        exit 1
    fi
fi
export ANDROID_SDK_ROOT="$ANDROID_HOME"
echo "✅ Android SDK: $ANDROID_HOME"

# 3. Dependencies installieren
echo ""
echo "📦 Dependencies installieren..."
npm install --legacy-peer-deps

# 4. Expo Prebuild (Android)
echo ""
echo "🔧 Expo Prebuild (Android)..."
rm -rf android
npx expo prebuild --platform android --no-install

# 5. Gradle Build
echo ""
echo "🏗️  APK bauen (das kann 5-15 Minuten dauern)..."
cd android
chmod +x gradlew
./gradlew assembleRelease

# 6. APK finden
APK_PATH=$(find . -name "*.apk" -path "*/release/*" | head -1)

if [ -n "$APK_PATH" ]; then
    # APK ins Projektroot kopieren
    cp "$APK_PATH" ../../irm-mobile.apk
    echo ""
    echo "══════════════════════════════════════════"
    echo "✅ APK erfolgreich erstellt!"
    echo ""
    echo "📱 Datei: packages/mobile/irm-mobile.apk"
    echo "📏 Größe: $(du -h ../../irm-mobile.apk | cut -f1)"
    echo ""
    echo "Installation auf Android-Gerät:"
    echo "  1. APK aufs Handy übertragen (USB/Email/Cloud)"
    echo "  2. 'Aus unbekannten Quellen installieren' erlauben"
    echo "  3. APK öffnen und installieren"
    echo "══════════════════════════════════════════"
else
    echo "❌ Keine APK gefunden. Build-Log prüfen."
    exit 1
fi
