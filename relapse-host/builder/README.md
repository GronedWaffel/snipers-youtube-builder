# Snipers YouTube builder

The browser selects pinned hosted payloads or explicitly chosen ELF files. The
server validates the files, builds an independent native startup ELF containing
the selection, then embeds that ELF in a Y2JB image. Uploaded payloads are never
executed on the build server. Build files and codes expire after two hours.

The native installer downloads the image, verifies SHA-256 from the HTTPS-served
installer configuration, checks storage readback, and saves a verified backup
before an atomic replacement. It only targets
`/user/download/PPSA01650/download0.dat`. Mode 1 only verifies; mode 2 installs.
Saved progress/results are in `/data/snipers-youtube-installer-<job>.log`.

## Requirements and building

- Node.js 24; Python 3 for packaging.
- Zig 0.14.1; PS5 Payload SDK 0.43, including its target headers, libraries and
  `elf_x86_64.x` link script. See the SDK source download linked on the credits page.
- .NET for `relapse-y2jb/tools/ufs2`; the VPS deployment uses .NET runtime 10.
- Matching etaHEN r3 source/build inputs from the release linked in
  `relapse-y2jb/SNIPERS-CREDITS.md`. Installer metadata parsing uses its
  `Source Code/extern/tiny-json` source.
- Payload bytes must match `server/payloads.mjs` and `site/src/optional-manifest.js`.
  The source archive excludes compiled payloads and private console artifacts.
  The SDK and other hosted payload sources are linked separately on the credits page.
- Clone the included `relapse-kernel.bundle` into the kernel repository location
  expected by `relapse-y2jb/tools/build-snipers.mjs`. Preserve its pinned revision.

On Windows, with dependencies at the paths used by the scripts:

```powershell
node relapse-host/builder/build-youtube-installer.mjs
node relapse-host/builder/build-readiness.mjs
node relapse-host/scripts/build-shadowmount-compat.mjs --y2jb-candidate
node relapse-host/scripts/build-optional.mjs --y2jb-candidate
node --test relapse-host/builder/tests/*.test.mjs
```

The worker calls `build-handoff-startup.mjs --out <job/native> --selection
<job/selection.json>`. Set `ZIG` and `PS5_PAYLOAD_SDK` to override its compiler and
SDK locations on Linux. It then calls `build-snipers.mjs --handoff-startup` using
the resulting single-ELF manifest. The default no-argument handoff command is a
local hardware-test convenience; it is not the server build entry point.

`server/start.mjs` configures the server from environment variables. Generation
requires `SNIPERS_BUILDS=1`. Real installation additionally requires
`SNIPERS_INSTALL_ENABLED=1`; otherwise new installers only verify. An existing
verification code does not become an installer when that setting changes.

## Console behavior

Current support is PS5 13.60 and YouTube PPSA01650 version 01.000.030.
Build directly in the PS5 browser; other devices and build codes are optional.
With etaHEN DPI v2 enabled, a real installer can request the pinned YouTube app
when it is missing, wait for its registered package and checksum, then install
the startup bundle. It never silently replaces an unsupported installed version
or resubmits an uncertain DPI request. Fresh-app installation was subsequently tested by the maintainer; see the repository-root TESTING.md for the scope.
Keep YouTube closed and etaHEN active. On the next boot, YouTube performs the kernel chain and hands
off to the native startup. The native process verifies its embedded payloads,
closes YouTube, waits for its mounts to release, waits five seconds, then starts
the payload sequence. It checks etaHEN Toolbox and kstuff readiness before any
following payload. A custom payload without an acknowledgement is only reported
as sent, not verified ready. Neither a failed kernel run nor a failed payload
handoff is automatically retried.

The recommended three-payload native flow has passed console tests. Other
hosted payloads and uploaded custom combinations require their own validation.
The website installation flow and initial YouTube package provisioning are
separate from that cold-boot validation; check release evidence before promotion.

## Licenses

Native installer and supervisor integration use GPL-3.0-or-later. Relapse/Y2JB
and the JavaScript integration retain their existing MIT notices. UFS2 and
individual payload components keep their own notices. See `SNIPERS-CREDITS.md`
and the included component licenses. No Sony app package, private job state,
credentials or console logs are included in the source archive.
