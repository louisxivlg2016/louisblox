#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
if [[ ! -f build/louisblox-release.apk ]]; then
  printf 'APK absent. Lance d’abord bun run apk:release.\n' >&2
  exit 1
fi
mapfile -t devices < <(adb devices | awk 'NR > 1 && $2 == "device" {print $1}')
if (( ${#devices[@]} == 0 )); then
  printf 'Aucun téléphone détecté. Connecte-le en USB et active le débogage USB, ou configure adb Wi-Fi.\n' >&2
  exit 1
fi
serial="${ANDROID_SERIAL:-${devices[0]}}"
adb -s "$serial" install -r build/louisblox-release.apk
adb -s "$serial" shell monkey -p com.louisblox.game 1
