#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk}"

bun install --frozen-lockfile
bunx expo prebuild --platform android --no-install
./android/gradlew -p android :app:assembleRelease
mkdir -p build
cp android/app/build/outputs/apk/release/app-release.apk build/louisblox-release.apk
printf 'APK release prêt : %s/build/louisblox-release.apk\n' "$PWD"
