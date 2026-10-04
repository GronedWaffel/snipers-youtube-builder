# Experimental channel

Use [experimental/README.md](experimental/README.md) for this branch. All 33 candidates passed local integration, not hardware validation. The instructions and results below describe the historical stable 13.60 build.

# Building and self-hosting

This repository is a source snapshot of a Windows-built integration. It is not a one-command SDK distribution. Keep the sibling directory layout; do not flatten `relapse-host`, `relapse-y2jb`, and `etahen-13.60`.

## Dependencies

Use Node.js 24, Python 3, Git, Zig 0.14.1, .NET SDK 9 (the UFS2 project targets net9.0), and PS5 Payload SDK 0.43. Most scripts support `ZIG` and `PS5_PAYLOAD_SDK`; older native helper scripts expect the toolchain at `ps-neighbourhood/tools/zig-x86_64-windows-0.14.1/zig.exe` and `ps-neighbourhood/tools/ps5-sdk-0.43/ps5-payload-sdk` beneath the repository root. These are toolchain directories, not an included PS Neighborhood application.

Obtain etaHEN's external archives and payload inputs listed in [etahen-13.60/BUILDING.md](etahen-13.60/BUILDING.md) and verify `BUILD-INPUTS.json`. ShadowMount's build script records its dependency archive URL and SHA-256. Upstream Y2JB binaries excluded from this source export must be obtained at the exact revision and checked against `relapse-y2jb/third_party/y2jb-host/SOURCE.json`.

Restore the pinned public kernel repository:

```powershell
git clone relapse-host/artifacts/youtube-installer/relapse-kernel.bundle relapse-y2jb/third_party/Relapse-Exploit
git -C relapse-y2jb/third_party/Relapse-Exploit checkout dd8e4e0914c5e9d066ee1f9b056be76cb992c8e0
```

## Native components and tested variant

After provisioning matching external inputs:

```powershell
cd etahen-13.60
node scripts/build-all.mjs
node scripts/build-shellui-trace.mjs
cd ..
node relapse-host/builder/build-youtube-installer.mjs
node relapse-host/builder/build-readiness.mjs
node relapse-host/scripts/build-shadowmount-compat.mjs --y2jb-candidate
node relapse-host/scripts/build-optional.mjs --y2jb-candidate
```

The trace build writes to `etahen-13.60/build/shellui-trace/` without replacing baseline outputs. It adds in-memory initialization markers and retains the prior publisher diagnostic. It does not shorten startup waits or automatically recover a crashed ShellUI. The tested configuration also had Display title IDs disabled in etaHEN.

`release/tested-selection.json` records the exact tested payload inputs. Obtain/build the matching PS5Debug supervisor separately using `build-optional.mjs --only=debug` and place it at the manifest's input path. If rebuilt hashes differ, investigate the input/toolchain difference and record a new selection; do not silently treat it as the tested artifact. Cross-machine byte-for-byte reproducibility has not been established.

Build an isolated startup image once all selected bytes match:

```powershell
node relapse-host/builder/build-handoff-startup.mjs --out build/recommended/native --selection release/tested-selection.json
node relapse-y2jb/tools/build-snipers.mjs --handoff-startup --out build/recommended/image --selection build/recommended/native/selection.json
```

The image builder refuses an existing output directory. Do not send both the standalone etaHEN payload and its bundled startup in the same boot.

## Website service

See [builder/README.md](relapse-host/builder/README.md). `server/start.mjs` binds to localhost; a reverse proxy provides HTTPS. Configure `BUILDER_ORIGIN`, `BUNDLE_HOST`, `BUNDLE_ADDRESS`, `BUILDER_STORAGE`, and the toolchain paths for your host. Set `SNIPERS_BUILDS=1` to enable generation and `SNIPERS_INSTALL_ENABLED=1` only when the complete installation environment is provisioned. The legacy deployment helper is specific to the original VPS; adapt it before using it elsewhere.

The browser installer also needs `/payloads/loader.js`, `/payloads/catalog.json`, and the pinned `/online/2ea9344fcd6fbcb7/` runtime served from `relapse-host/site`. The builder's nginx route must strip `/builder/` before proxying and overwrite `X-Real-IP`. `/youtube-bundles/` must route to the same worker service for console downloads. Expose build storage only through those checked routes. The original website's compiled catalog payloads are external inputs.

The historical `server/payloads.mjs` catalog pins r3. To offer the ten-run trace variant on a new deployment, use the etaHEN entry's input, length, and SHA-256 from `release/tested-selection.json`; do not describe r3 as the trace variant. Source publication alone does not update an existing website.

## Tests

```powershell
node --test etahen-13.60/tests/*.test.mjs
node --test relapse-host/builder/tests/*.test.mjs
```

etaHEN native tests require Zig/SDK paths. Builder installer tests require the built installer template. `handoff-image.test.mjs` expects the recommended native bundle and manifest at `relapse-host/artifacts/youtube-handoff-startup/`; build that fixture with `build-handoff-startup.mjs --out` and the tested selection before running it. The website tests run against a temporary local service. No command above launches an app on a console.
