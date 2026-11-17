# Selective upstream synchronization

## 2026-11-16 — 1.37.1-fork.1 (99)

The integration starts from fork `52e70ae7` and takes selected behavior from upstream through `49d254eda4913d66d2c8fc691093e51211b7202f`. The minimum supported system remains macOS 15. The source/rendered preview toggle, bundled Finder renderer, local image paths, KaTeX, Mermaid, enhanced paste, editable preview tasks and code highlighting remain built in.

### Saving and content synchronization

- `423bbae` / macOS 15 backport `e6643fb`: use AppKit's callback autosave entry point.
- `5544ec2`, `17752d4`: preserve pending edit notifications across debounced selection updates and keep native text outdated when another edit arrives during synchronization.
- `22eb9db`, `0e10c45`: compare saved/pending file bytes before treating timestamp changes as content conflicts; avoid unnecessary editor reloads.
- `49d254e`: prevent coordinated presenter autosaves from suspending on WebKit or saving stale native text.
- `19baac8`, `d5f451e`, `abba496`: preserve existing file extensions and declare MDX, TeX and Mermaid types.
- `9519ef6`: prepare external initial content after pending editor resets and scope external filenames to their own document.

The saving behavior is adapted into the fork's document model. Its TextBundle asset merging, close confirmation, version history and preview state are preserved. A small history extension keeps the document implementation within the existing lint size limit.

### Native Quick Search

Foundation-based `QuickSearchCore` and AppKit-based `QuickSearchUI` are integrated with the File menu, ⇧⌘O shortcut, security-scoped bookmarks and the existing theme system. The implementation includes upstream ranking, query restoration, file-discovery and command-availability refinements through the frozen revision. Folder access remains explicitly granted in File → Bookmarks. Existing new-window and Open panel defaults are preserved.

The revision-aware document outline (`de76e15`) and focus restoration (`2bd7e6a`) are internal bridge additions. Search navigation uses rendered source-block mappings while preview mode is active; source editing continues to use normal caret navigation. Search activation handles an empty legacy document-open callback without relying on Swift's nonoptional async import.

### Input, layout and compatibility

- `9235d60`, `7a9596e`: avoid repositioning marked IME text and improve final-line centering in typewriter mode.
- `0033d86`: completion-list content margins.
- `a80a856`, `17afe2f`, `09b1cb3`: menu-title visibility, context-menu separators and statistics insets.
- Main-editor and Quick Look reading width default to full width. Explicitly selected main-editor width preferences are preserved.

Plugin managers, plugin runtimes, new plugin APIs, AI features, plugin-derived functionality and upstream macOS 26/toolchain/project migrations are outside this integration. No plugin installation is needed for Quick Search.

### Validation

Regression tests cover queued edit notifications, IME scroll retries, rendered search navigation, revision-aware snapshots, bookmark lifetime, search ranking and interaction, save callbacks, actual disk bytes, timestamp-only changes, external edits and coordinated file access. Hosted app tests use isolated preferences and document directories and bypass ordinary startup/installed scripts.

Run the frontend checks from `CoreEditor`:

```sh
node .yarn/releases/yarn-4.17.1.cjs build
node node_modules/typescript/bin/tsc --noEmit --composite false --incremental false
node node_modules/jest/bin/jest.js --runInBand
```

Native schemes: `MarkEditMacTests`, `ModulesTests`, `MarkEditCoreTests`, `MarkEditKitTests`, `UpdaterCoreTests`. Build the production app with `./script/build_and_run.sh --release-build`.

Runtime tests were performed on the current development Mac, not on a macOS 15 machine. Deployment targets and built bundle metadata are verified separately. The initial SwiftPM download of the existing SwiftLint 0.65.0 tool failed; local verification used an independently downloaded archive whose SHA-256 exactly matches the configured checksum. The repository keeps its original remote SwiftLint target and checksum.
