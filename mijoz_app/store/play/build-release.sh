#!/usr/bin/env bash
# Barakali Bozor (mijoz) — Play uchun imzolangan AAB yig'ish.
# Oldindan: android/key.properties (android/key.properties.example dan nusxa) to'ldirilgan bo'lsin.
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -f android/key.properties ] || { echo "android/key.properties yo'q — avval uni yarating"; exit 1; }
flutter pub get
flutter analyze
flutter test
# --obfuscate: crash'larni o'qish uchun symbols saqlanadi (Crashlytics'ga yuklang)
flutter build appbundle --release --obfuscate --split-debug-info=build/symbols
VER=$(grep '^version:' pubspec.yaml | awk '{print $2}' | tr '+' '-')
mkdir -p store/play/release
cp build/app/outputs/bundle/release/app-release.aab "store/play/release/BB-Mijoz-$VER.aab"
echo "Tayyor: store/play/release/BB-Mijoz-$VER.aab"
