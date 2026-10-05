# Unified builder implementation

The historical `experimental` directory now supplies the main builder and payload library. The 14 exact profiles cover 11.00 through 13.60, excluding 11.40; firmware below 11.00 is not offered. Older offset tables remain as source history.

The release uses the unchanged, tested Unified r1 etaHEN ELF. See `../etahen-13.60/RELEASE-NOTES-unified-r1.md` for features, hardware observations and limitations. Local image/installer checks establish build and file integrity, not console compatibility. Existing installations must be rebuilt to receive this update.

Installation requires an existing jailbreak and etaHEN. Select the exact firmware. YouTube PPSA01650 01.000.003 is used below 12.60 and 01.000.030 at 12.60 and later. The installer checks firmware, verifies package/image bytes, and reconciles a missing DPI response against installation completion. Do not load standalone etaHEN and the bundled startup in the same boot.

## Rebuilding

Keep the sibling source directories. Provide Node 24, Zig 0.14.1, PS5 Payload SDK 0.43, .NET SDK 9 or later and the external inputs in `../etahen-13.60/BUILDING.md`. Set `ZIG`, `PS5_PAYLOAD_SDK`, `DOTNET` and optionally `SNIPERS_UFS_DLL`. Restore the pinned Y2JB inputs described by `../relapse-y2jb/third_party/y2jb-host/SOURCE.json` and the kernel Git bundle described in the root source archive.

```text
node experimental/generate-profiles.mjs
node experimental/build-etahen.mjs
node relapse-host/scripts/build-optional.mjs
node experimental/refresh-catalog.mjs
node experimental/build-native.mjs
dotnet build relapse-y2jb/tools/ufs2/ImageBuilder.csproj -c Release
node experimental/verify-integration.mjs
node experimental/verify-integration.mjs --all-payloads 11.00 13.60
```

## Hosting and migration

The unified service binds loopback port 8791, with independent storage, a 100-session capacity, two build workers and 20-minute expiry. Preserve legacy services and download routes while their sessions drain. `/builder/ex` and `/payloads/ex` pages redirect to the normal pages; existing job and payload URLs must remain readable. The native installer downloads packages and bundle bytes over the explicitly configured HTTP routes. Deployment examples live in `deploy/`.

PS Neighborhood and GTA V publish normal releases with the same firmware list. Neighborhood's firmware-sensitive package/patch/save operations retain their 13.60 restrictions; GTA retains game fingerprint, Story Mode and compare-before-write checks.

## Diagnostics and credits

Use **Upload etaHEN log** on the builder from a jailbroken PS5. The collector submits startup logs to private server storage and displays a receipt. Existing configuration and diagnostic paths are retained for compatibility. See `diagnostics/README.md` for collection details. Component credits and licenses remain in the root `CREDITS.md`, `LICENSES.md` and pinned `upstream/` research.
