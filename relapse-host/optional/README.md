# Optional payloads for PS5 13.60

## Payload Manager v0.5.2

Upstream: itsPLK and contributors, GPL-3.0, https://github.com/itsPLK/ps5-payload-manager/releases/tag/v0.5.2. This release explicitly adds firmware 13.60 support. The unchanged upstream `pldmgr.elf` SHA-256 is `62b3ba2a4937c2afc502f9a4e7242cca538610ebb4ae2800c7c6f72e7f268e7c`. Store it as `vendor/pldmgr.elf`, then run `node scripts/build-optional.mjs --only=payloadmanager`; this preserves the existing other wrappers.

The manager offers its Media card and HTTP port 8084. Our supervisor skips existing processes or occupied ports. On first installation it exclusively creates a configuration disabling separate autoload, automatic browser opening and Disc Player closing. Existing configuration is never overwritten; conflicting settings stop that launch with an explanation. This prevents the manager from duplicating our payload queue or closing its browser. Source/build/integrity checks are complete; the new manager sequence has not been tested on the console in this update.

The website can start ShadowMountPlus 1.7beta2 and PS5Debug-NG 1.3.2 after the existing etaHEN build. Both options default to unchecked. kstuff-lite and FTP remain provided by etaHEN; no second kstuff payload is offered; optional ftpsrv uses port 2121 separately from etaHEN FTP on 1337. Standalone BackPork is intentionally excluded because its sandbox mounts conflict with ShadowMountPlus.

## Provenance and compatibility

- ShadowMountPlus: drakmor and the upstream VoidWhisper/Gezine/Earthonion/EchoStretch/community contributors, GPL-3.0. Exact upstream 1.7beta2 ELF SHA-256 `3f716a7b2220c7e87e87452ae05cad689ef842d3beb4cdad6c526cb6dfc2b6b5`. Source: https://github.com/drakmor/ShadowMountPlus/tree/1.7beta2. Its 1.7 release line explicitly supports 13.60 and kstuff-lite 1.07+. This host's etaHEN embeds kstuff-lite 1.11. The upstream ELF is unchanged.
- PS5Debug-NG: Pharaoh2k/OSR and contributors, based on CTN/SiSTR0's debugger lineage, GPL-3.0-only. Exact 1.3.2 ELF SHA-256 `949b0e6e0fe3f24f4a820319fd76d9ccb92f9770cbb1a64b09a8eca5c1fc9ff3`. This is the same payload already used by the etaHEN port and PS Neighbourhood. Source archive is supplied beside the hosted binary.
- Supervisor and kstuff state checks: this host/etaHEN 13.60 port, GPL-3.0-or-later. `vendor/libelfldr` and `vendor/libNineS` preserve John Tornblom's copyright and GPL notices, with the existing etaHEN port's 13.60 process-memory compatibility changes. The pt.c include path is adjusted for this vendored layout.
- Runtime: PS5 payload SDK 0.43, John Tornblom and contributors. Matching SDK source is supplied in Downloads.

## Startup behavior

All selected supervisors are size/hash checked before the jailbreak, including offline. They run serially after etaHEN; each embeds its pinned upstream payload. The native supervisor checks the actual firmware, existing process names and occupied service ports. PS5Debug is recognized through its read-only platform command because its installer exits and the server lives inside SceShellCore.

Before a new launch, it requires the live etaHEN critical daemon, its completed-startup log entry, recognized installed kstuff markers, and ShadowMount's own read-only KEKCALL_CHECK. An installed kstuff instance can have paused syscall vectors; this is not confused with a missing payload, and the supervisor does not rewrite those vectors.

ShadowMount refuses to launch if BackPork is found or process enumeration is inconclusive. Existing services are skipped rather than killed or replaced. A boot-local exclusive attempt marker remains even after a failed launch. A failed or uncertain result stops the browser's remaining optional queue without automatic retry. Acknowledgements distinguish skipped/ready from merely transmitted bytes. ShadowMount readiness means its child process and default API port 10101 are present; a custom port or disabled API cannot be verified and is reported as such.

## Build

Use Node 24, Zig 0.14.1, PS5 payload SDK 0.43. Set `ZIG` and `PS5_PAYLOAD_SDK` for non-default paths. Download the exact ShadowMount ELF to `vendor/shadowmountplus-1.7beta2.elf`; set `PS5DEBUG_ELF` to the exact 1.3.2 ELF. The script refuses mismatched inputs.

    node scripts/build-optional.mjs
    node scripts/build-offline.mjs
    node --test tests/*.test.mjs

Generated supervisors are in `site/payloads/optional-*.elf`; their manifest records upstream and wrapper hashes. All wrapper source and vendored dependencies are in the host source archive.

## Hardware checks and limits (2026-09-30)

On the user's PS5 13.60 with the published etaHEN ELF, ShadowMountPlus 1.7beta2 started successfully. Its log confirmed launch, sandbox and title-install hooks, runtime kstuff control, lifecycle watcher, initial scan and the local HTTP/JSON service. The existing PS5Debug remained responsive and identified as 1.3.2 on 13.60. Repeating each supervisor skipped the existing service without reinjection.

No game dumps were present in the scanned library, so actual image mounting, game launch/exit and rest-mode stress testing are not verified by these checks. Neither a successful startup nor static offset review is a guarantee against crashes or corruption. Upstream still warns about image-mount shutdown/data-loss risks; PFS is experimental. Back up important data. The full fresh-boot browser sequence also needs a user hardware check after deployment.

## Additional services awaiting console validation

NanoDNS 0.4 (drakmor), Web File Manager 1.9 (owendswang), websrv 0.34 and ftpsrv 0.21.1 (John Törnblom and contributors) are built with the same guards. Their UI options are enabled at the project owner’s request. These four have not yet been hardware-tested with our etaHEN build on 13.60; enabling them does not change that status. Exact upstream and wrapper hashes are in `site/src/optional-manifest.js`. Inputs are `vendor/nanodns.elf`, `vendor/filemanager.elf`, `vendor/websrv.elf`, and `vendor/ftp.elf`; matching source archives are linked from Credits.

NanoDNS binds local UDP 53. It creates `/data/nanodns/nanodns.ini` only when absent, with `/dev/null` query-file logging, User’s Guide mapped to the host, and the host’s targeted Sony rules. Existing configurations and console DNS settings are preserved. It is only available after jailbreak; the public DNS remains the pre-jailbreak User’s Guide entry. Web File Manager uses HTTP 8888 and installs its own Media card. Its optional archive extraction helper is not bundled. websrv uses HTTP 8080; ftpsrv uses FTP 2121.
