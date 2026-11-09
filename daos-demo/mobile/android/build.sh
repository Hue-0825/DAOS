#!/usr/bin/env bash
set -euo pipefail
# Use the Android SDK build-tools, platform jar, and a JDK already installed.
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
ANDROID_BUILD_TOOLS=${ANDROID_BUILD_TOOLS:?Set the directory containing aapt2, d8, zipalign, apksigner}
ANDROID_PLATFORM_JAR=${ANDROID_PLATFORM_JAR:?Set the path to android.jar}
JAVA_HOME=${JAVA_HOME:?Set the JDK location}
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"
OUTPUT=${1:-"$ROOT/mobile/android/DAOS-Driver.apk"}
case "$OUTPUT" in /*) ;; *) OUTPUT="$PWD/$OUTPUT";; esac
TEMP=$(mktemp -d)
trap 'rm -rf "$TEMP"' EXIT
mkdir -p "$TEMP/classes" "$TEMP/dex" "$TEMP/assets/driver"
for file in "$ROOT"/driver/*; do
  case "$file" in */jobs.json) continue;; esac
  cp "$file" "$TEMP/assets/driver/"
done
"$ANDROID_BUILD_TOOLS/aapt2" link -I "$ANDROID_PLATFORM_JAR" --manifest "$ROOT/mobile/android/AndroidManifest.xml" -A "$TEMP/assets" -o "$TEMP/unsigned.apk"
javac --release 8 -classpath "$ANDROID_PLATFORM_JAR" -d "$TEMP/classes" "$ROOT/mobile/android/src/kr/daos/driver/DriverActivity.java"
jar cf "$TEMP/classes.jar" -C "$TEMP/classes" .
"$ANDROID_BUILD_TOOLS/d8" --min-api 24 --lib "$ANDROID_PLATFORM_JAR" --output "$TEMP/dex" "$TEMP/classes.jar"
(cd "$TEMP/dex" && zip -q "$TEMP/unsigned.apk" classes.dex)
"$ANDROID_BUILD_TOOLS/zipalign" -f -p 4 "$TEMP/unsigned.apk" "$TEMP/aligned.apk"
KEYSTORE=${DAOS_ANDROID_KEYSTORE:-"$TEMP/demo.keystore"}
if [[ ! -f "$KEYSTORE" ]]; then
  keytool -genkeypair -keystore "$KEYSTORE" -storepass android -keypass android -alias daos-demo -dname 'CN=DAOS Driver Demo' -keyalg RSA -validity 3650 >/dev/null
fi
"$ANDROID_BUILD_TOOLS/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:android --key-pass pass:android --out "$OUTPUT" "$TEMP/aligned.apk"
"$ANDROID_BUILD_TOOLS/apksigner" verify "$OUTPUT"
