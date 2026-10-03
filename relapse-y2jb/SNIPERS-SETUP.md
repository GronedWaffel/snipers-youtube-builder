# Snipers Relapse Y2JB — PS5 13.60

## Current website builder and native handoff

The website builder uses `--handoff-startup`: after successful kernel cleanup,
it launches an independent ELF that owns all selected payload bytes. That ELF
closes YouTube, confirms the app and mounts have gone away, waits five seconds
on the dashboard, and dispatches the selected payloads in order. The recommended
etaHEN, ShadowMountPlus and PS5Debug-NG sequence passed repeated console tests
with the five-second delay. Other library entries and custom uploads still need
their own startup validation.

When etaHEN is selected, the builder inserts its readiness checker immediately
after it; subsequent payloads wait for Toolbox and kstuff readiness. Custom
payloads without a readiness protocol are reported only as sent. They must not
require YouTube to remain running.

The website installer requires an already jailbroken PS5 on 13.60, etaHEN's ELF
loader, and YouTube PPSA01650 version 01.000.030 installed and closed. It verifies
the downloaded image and a saved backup before replacing `download0.dat`.
Verification-only builds never replace the startup image. The native installer
saves a per-build result in `/data/snipers-youtube-installer-<job>.log`.

The following sections document the older direct-dispatch builds. Their manual
dashboard instructions and fixed three-payload list do not apply to a build
made with `--handoff-startup`.

## Historical direct-dispatch builds

This build uses **edisnord/relapse-y2jb** with the original **Gezine/Y2JB 1.7**
host. Opening YouTube starts Relapse, then etaHEN 2.5B 13.60 r3, the matched
ShadowMountPlus 1.7beta2 build, and PS5Debug-NG 1.3.2. No PC sender or internet
download is needed at startup. The three payloads live inside the image.

It does not use itsPLK's separate autoloader, Payload Manager, a configurable
payload list, NanoDNS, BackPork, websrv or an extra FTP/kstuff payload. etaHEN's
own bundled FTP and kstuff remain intact. The remote JavaScript server is omitted.

## Current validation

**r11 is withdrawn:** the user reported two console crashes with the timing
candidate and stopped the profiling experiment. Use the last working r10 image;
retain r10's normal etaHEN readiness wait and faster ShadowMount startup. Do not
reinstall r11 for routine testing. The crash cause has not been established.

The withdrawn r11 timing candidate (`SNIPERS_ETA_PROFILE=1`) keeps the r10 sequence
and startup waits, and adds monotonic timestamps to etaHEN's bootstrap and critical
service stages. It measures child process creation, ELF mapping, native writes,
full readback verification, and Toolbox publication. The original etaHEN r3 ELF
is preserved; the separate candidate is built with
`etahen-13.60/scripts/build-startup-profile.mjs`. This diagnostic run is needed
to attribute the remaining roughly 15.5-second etaHEN readiness interval before
changing its initialization behavior. It is not an additional speed fix.

Revision r10 removes an observed 15-second ShadowMount startup delay specific
to this YouTube launch path. The Y2JB-only ShadowMount candidate recognizes
`/dev/lvd2` mounted as `ppr_pfs` at `/mnt/sandbox/pfsmnt/PPSA01650-app0` and
continues without waiting for YouTube to release its own app mount. It does not
unmount that filesystem or change allocation/detach logic. Other mount owners
retain the original wait. Website payload files are unchanged.

The r9 successful cold-boot log measured about 15.6 seconds waiting for etaHEN
readiness, 16.7 seconds for ShadowMount, and 1.9 seconds for PS5Debug. ShadowMount's
own log accounts for 15 seconds waiting for the active YouTube mount. r10 is
expected to remove that delay; new console timings are still required.

The preceding r9 attempt failed Toolbox startup before hook publication and
blocked both optional payloads. Its last observed ShellUI stage was the decrypted
version string. That does not establish why the dashboard froze or returned to
YouTube. The r10 supervisor logs live ShellUI PID changes and the failed startup
record, distinguishing a recorded Toolbox failure from a changed process.
etaHEN r3, its readiness checks, the manual Home countdown, and the kernel stage
remain unchanged. Do not treat this speed fix as a confirmed Toolbox crash fix.

Revision r9 restores manual return to Home. Fresh-boot r6 and r7 runs completed
etaHEN/kstuff, ShadowMount and PS5Debug successfully when the user returned Home
manually. r8's native automatic-Home attempt crashed YouTube immediately after
Relapse cleanup, before the log recorded an etaHEN transfer. The exact fault
is not established. Automatic navigation and its function lookup code are no
longer bundled in r9; source files remain only for investigation.

When Relapse confirms handoff and cleanup, a large red **GO TO DASHBOARD NOW**
banner appears, with **Hold the PS button. Keep YouTube running.** underneath.
A visible 10-second countdown gives time to return Home before etaHEN starts.
The console notification repeats the instruction. The banner remains while
payload startup runs and is removed on completion or failure. No native Home
function is called and YouTube is never automatically closed during startup.
The generated baseline kernel stage is unchanged.

r9 retains the CRC32 startup checks, exact payload sizes and ELF header checks.
Full SHA-256 verification is used at build/install time. r6 measured 3.382
seconds for the three CRC checks, compared with about 45 seconds for r4 SHA
checks. The PC log mirror preserves bootstrap diagnostics during startup.
r9 subsequently completed one fresh-boot chain after a Toolbox failure on the
preceding boot. The successful runs establish a working path, not long-term
reliability or the original crash cause.

Revision r4 retries an empty interface-address query for up to 60 seconds before
writing the attempt marker, and rechecks at the KASLR step. A ready LAN adds no
intentional wait. This handles transient missing-address results; a disconnected
console must still regain a LAN address. It never retries the kernel exploit.
Payload transfers now copy aligned 8-byte words instead of individual bytes,
file reads yield between chunks, and SHA-256 no longer duplicates the entire
ELF or allocates arrays for each compression block. Hash validation is retained.
Script loads, file reads, checks and startup steps report elapsed time; supervisor
progress is displayed. Optional `SNIPERS_LOG_IP` mirrors Relapse/startup diagnostics
to a PC on UDP 5051 without waiting for a listener. The diagnostic candidate in
`dist/snipers-y2jb-13.60-r4-log5051` avoids the Windows service using port 5050.

The user reported r3 reached etaHEN with loopback DNS (`127.0.0.1`) and then the
whole console crashed. The long pause following `libkernel_base` precedes our
preflight and needs the new per-script timing to diagnose. Neither the full
console crash nor r4's hardware behavior is verified fixed. Keep the existing
recovery path until repeat cold boots complete the entire chain successfully.

Revision r3 changes payload preflight to open `/download0/...` from inside the
app sandbox before trying full system mount paths. Paths use native mmap memory,
and failed opens log their paths and errno. The r2 first offline test reached
preflight but its framework-only full-path lookup reported etaHEN missing before
the kernel stage. On console, r3 verified all three payloads and passed the worker
self-test. The kernel attempt then stopped with `kaslr: no interface has an
address` while the network connection was disabled. The complete startup chain
still needs a successful console test.

Revision r2 corrects a console-observed r1 packaging defect: YouTube replaced the
writable `splash.html` after launch, while every script and payload remained
intact and the app stayed on 01.000.030. The r2 image makes only `splash.html`
read-only (0444); the rest of the cache remains writable. A later console cache
readback confirmed the protected HTML survived launches unchanged. Do not use r1.

This is a **local test build, not a hardware-validated release**. The original
Relapse host simulation and the new sequence/transport tests exercise offline
behavior. The image builder verifies every file by SHA-256 readback and checks
UFS consistency. This is not proof that the image mounts or the sequence runs
on a PS5. Upstream documents successful app-close testing on 12.60; 13.60 still
requires a console test. This build never automatically closes YouTube.

## First installation using the existing jailbreak

1. Use your existing working website jailbreak to prepare the console. Close
   YouTube before changing its download image.
2. Install the appropriate YouTube application: **01.000.030** for firmware
   13.60. The usual title is **PPSA01650**; use the actual title ID if you have
   another region. The YouTube PKG is not included in this project.
3. Y2JB documents an account-activation prerequisite. Confirm the suitable
   offline/fake-activated account before the first launch; consult the original
   Y2JB README in `third_party/y2jb-host/README.md`. No account is changed by
   this build.
4. If `/user/download/<YouTube-title-ID>/download0.dat` already exists, keep a
   verified backup. Copy this build's `download0.dat` there through the existing
   FTP service while the application is closed. Verify the uploaded file against
   `SHA256SUMS.txt` before launching. This is a per-application file installation,
   **not a PS5 system-backup restore**.
5. Reboot to a fresh session, then open YouTube. Watch for file checks, Relapse
   completion, etaHEN startup, ShadowMount readiness and PS5Debug readiness.
   Wait for **Snipers startup complete**. Do not load the website's payload chain
   again in the same boot. Keep YouTube open for the initial validation.

Keep **Connect to the Internet** enabled and the PS5 connected to the LAN with
an assigned IP address: Relapse's routing-based KASLR step needs that interface.
For the next test, use Y2JB's documented manual primary DNS `127.0.0.2`, leaving
secondary DNS blank. This keeps the LAN address while preventing ordinary DNS
resolution. Reboot after the failed kernel attempt before trying YouTube again.
The previous recommendation to disable the network was incorrect for Relapse.
It bypassed the popup wait but removed the interface address the kernel stage
needs. Our Sony-only DNS service allows YouTube domains and did not prevent the
live YouTube page taking over; this restricted-DNS configuration still needs a
console test. Restore the previous DNS settings when website access is needed.

The original Y2JB instructions require blocking PSN/update traffic; your existing
DNS service is the relevant setup to verify. This package does not alter network
settings, system databases, game files, saves or accounts.

## Failure behavior

All three payload sizes, ELF headers and pinned CRC32 checksums are checked
**before the kernel stage**. Build and installation use full SHA-256 verification.
The sequence runs only after Relapse reports loader handoff and pipe cleanup.
ShadowMount's existing supervisor waits for the boot-local etaHEN acknowledgement,
checks the current processes/kstuff state, and refuses duplicate/conflicting loads.
PS5Debug is sent only after ShadowMount confirms readiness. Failed or ambiguous
transfers stop the sequence and are never resent after any payload bytes were sent.
The original Relapse one-run marker is preserved. Reboot rather than trying the
kernel exploit again after an uncertain failure.

## Build from this workspace

Requires Node.js and .NET 9 SDK. No npm dependencies are used.

```powershell
node --test tests/snipers.test.mjs tests/network.test.mjs tests/integrity.test.mjs
node tools/build-snipers.mjs
node --test tests/package.test.mjs
```

Output is `dist/snipers-y2jb-13.60-r9-manual-home/download0.dat` plus the loose image contents,
checksums, build manifest and file-verification receipt. The builder refuses an
existing output directory; use `--out <new-directory>` for another candidate.

The exact payload inputs are drawn from the sibling `etahen-13.60` and
`relapse-host` projects, with pinned hashes in `tools/build-snipers.mjs`. The
upstream Relapse submodule must be at the recorded commit. All original Y2JB
host inputs are hash-locked in `third_party/y2jb-host/SOURCE.json`.

The original generic `tools/build.mjs` remains available. Its only direct change
is accepting Windows CRLF input. `build-snipers.mjs` builds a 13.60-only script,
adds file preflight and a post-cleanup startup hook, and changes the original
Y2JB entry point from the remote server to that local script. The kernel exploit,
offsets, handoff and cleanup implementation remain upstream's.
