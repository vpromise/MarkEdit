#!/usr/bin/env bash
set -euo pipefail

TASK_MODE="${1:-run}"
TASK_DOCUMENT="${2:-}"
TASK_CONFIGURATION=Debug
TASK_BUILD_OPTIONS=()
if [[ "$TASK_MODE" == "--release-build" ]]; then
  TASK_CONFIGURATION=Release
  TASK_BUILD_OPTIONS=(ARCHS=arm64 CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO)
fi
TASK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TASK_DERIVED_DATA="$TASK_ROOT/.build/macOS"
TASK_APP="$TASK_DERIVED_DATA/Build/Products/$TASK_CONFIGURATION/MarkEdit.app"
TASK_BINARY="$TASK_APP/Contents/MacOS/MarkEdit"

case "$TASK_MODE" in
  run|--verify|--debug|--logs|--telemetry|--build-only|--release-build) ;;
  *) echo "Usage: $0 [--verify|--debug|--logs|--telemetry|--build-only|--release-build]" >&2; exit 2 ;;
esac

# Only stop a previous copy from this checkout's build directory.
if [[ "$TASK_MODE" != "--build-only" && "$TASK_MODE" != "--release-build" ]]; then
  /usr/bin/pkill -f "^${TASK_BINARY}([[:space:]]|$)" >/dev/null 2>&1 || true
fi

export YARN_GLOBAL_FOLDER="${TMPDIR:-/private/tmp}/markedit-yarn-global"
export YARN_CACHE_FOLDER="$TASK_ROOT/.build/yarn-cache"
export YARN_ENABLE_GLOBAL_CACHE=false
cd "$TASK_ROOT/CoreEditor"
node .yarn/releases/yarn-4.17.1.cjs install --immutable
node .yarn/releases/yarn-4.17.1.cjs build
cd "$TASK_ROOT"
xcodebuild -quiet build -project MarkEdit.xcodeproj -scheme MarkEditMac \
  -configuration "$TASK_CONFIGURATION" -destination 'platform=macOS' \
  -derivedDataPath "$TASK_DERIVED_DATA" \
  CODE_SIGN_IDENTITY=- CODE_SIGNING_ALLOWED=YES DEVELOPMENT_TEAM= REGISTER_APP_GROUPS=NO \
  ${TASK_BUILD_OPTIONS[@]+"${TASK_BUILD_OPTIONS[@]}"}

if [[ "$TASK_MODE" == "--build-only" || "$TASK_MODE" == "--release-build" ]]; then
  exit 0
fi
if [[ "$TASK_MODE" == "--debug" ]]; then
  exec lldb -- "$TASK_BINARY"
fi

if [[ -n "$TASK_DOCUMENT" ]]; then
  /usr/bin/open -n -a "$TASK_APP" "$TASK_DOCUMENT"
else
  /usr/bin/open -n "$TASK_APP"
fi
case "$TASK_MODE" in
  --verify)
    sleep 2
    /usr/bin/pgrep -f "^${TASK_BINARY}([[:space:]]|$)" >/dev/null
    echo "MarkEdit launched: $TASK_APP"
    ;;
  --logs|--telemetry)
    exec /usr/bin/log stream --info --style compact --predicate 'process == "MarkEdit"'
    ;;
esac
