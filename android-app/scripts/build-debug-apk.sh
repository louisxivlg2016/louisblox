#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk}"

bun install --frozen-lockfile
bunx expo prebuild --platform android --no-install
./android/gradlew -p android :app:assembleDebug
mkdir -p build
cp android/app/build/outputs/apk/debug/app-debug.apk build/louisblox-debug.apk
printf 'APK debug prêt : %s/build/louisblox-debug.apk\n' "$PWD"
