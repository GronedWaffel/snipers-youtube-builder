# Experimental multi-firmware channel

This channel targets 33 exact firmware versions from 7.00 through 13.60. **9.05 and 11.40 are excluded**: no matching public Relapse tables were found. Adjacent firmware offsets are never substituted.

Use [the experimental builder](https://sniperscheats.lol/builder/ex/). The [stable 13.60 builder](https://sniperscheats.lol/builder/) and stable releases remain separate.

Every target passed a local build of the native startup loader, complete verified UFS2 image, and personalized installer. All eight hosted payloads also passed image integration at 7.00 and 13.60. These are build and file-integrity checks, **not console validation**. The experimental etaHEN binary has no claimed hardware validation; the original stable 13.60 ten-run result does not transfer to this build.

Installation requires an existing jailbreak and etaHEN. Choose the console's exact firmware. YouTube PPSA01650 01.000.003 is used below 12.60; 01.000.030 is used at 12.60 and later. The installer verifies package bytes and installed metadata, checks firmware before changing files, and recovers from a missing DPI reply by observing installation completion. Never load standalone etaHEN and the bundled startup in the same boot.

etaHEN uses a separate experimental configuration and startup receipts. Profiles combine pinned public Relapse, SDK and kstuff tables; the embedded kstuff v1.11 release was checked independently. Mono Boot ABI checks reject an unknown signature before hook publication. Toolbox behavior and optional upstream payload compatibility still need community testing on each firmware. The Toolbox card helper remains 13.60-only.

## Rebuilding

Keep the three sibling source directories. Provision Node 24, Zig 0.14.1, PS5 Payload SDK 0.43, .NET SDK 9, and the external inputs listed in `../etahen-13.60/BUILDING.md`. Set `ZIG` and `PS5_PAYLOAD_SDK`. Restore the exact Y2JB files named in `../relapse-y2jb/third_party/y2jb-host/SOURCE.json`, including its excluded compiled inputs. Initialize the pinned kernel with `git submodule update --init` (or the bundled kernel Git archive described in the root build guide).

From the repository root:

```text
node experimental/generate-profiles.mjs
node experimental/build-etahen.mjs
node relapse-host/scripts/build-optional.mjs
node experimental/refresh-catalog.mjs
node experimental/build-native.mjs
dotnet build relapse-y2jb/tools/ufs2/ImageBuilder.csproj -c Release
node experimental/verify-integration.mjs
node experimental/verify-integration.mjs --all-payloads 7.00 13.60
```

The local verifier sets a Windows SDK fallback when environment variables are absent; other platforms must supply their own paths. `SNIPERS_UFS_DLL` can point to the prebuilt ImageBuilder.dll. `DOTNET` selects a nonstandard dotnet executable. Native build outputs and Sony packages are not source-release contents. Pinned source dependencies and their licenses retain the original authors' credits.

## Hosting

`deploy/` contains isolated service and nginx examples. Use a separate storage directory, service user and port 8789. Supply immutable SDK, Zig, .NET and UFS paths, plus writable compiler caches under the service's data directory. Serve both pinned YouTube packages from the separate `youtube-packages` alias over HTTP as well as HTTPS. Validate local builds before setting `SNIPERS_BUILDS=1` and `SNIPERS_INSTALL_ENABLED=1`. The release manifest records per-firmware promotion; missing candidates stay disabled.

Build sessions expire after 20 minutes. Experimental defaults are 20 sessions and one worker. The stable service's queue and files are independent. Public downloads are addressed through checked routes, never a directory listing of job storage.

## Related program releases

PS Neighborhood and GTA V publish separate experimental releases using the same exact firmware list. PS Neighborhood keeps native package installation, patch removal, decrypted-save operations and ShadowMount batch registration restricted to 13.60. GTA retains game-build fingerprint, Story Mode, compare-before-write and rollback checks. Protocol compatibility and successful compilation do not establish hardware compatibility.

See the root `CREDITS.md`, `LICENSES.md`, pinned research in `upstream/`, and `integration-results.json` for provenance and recorded checks.

## Community diagnostic reports

Experimental etaHEN now records persistent startup diagnostics. After recovery, use **Upload experimental etaHEN log** on either builder (or `/build`) from the jailbroken PS5. The button runs a read-only collector and sends the selected logs over HTTPS to private server storage. Reports receive a reference ID. See [diagnostic details](diagnostics/README.md) for coverage, retention, privacy, limits, and operator access. Download a fresh experimental ELF or rebuild your YouTube bundle to receive the logger; existing installed bundles do not change automatically.
