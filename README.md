# Snipers YouTube Builder - experimental multi-firmware

Create a YouTube startup bundle for 33 exact PS5 firmware targets from 7.00 through 13.60. **9.05 and 11.40 are excluded.** Choose hosted payloads or your own ELF files directly on PS5, or optionally from a phone/computer.

[Open the experimental builder](https://sniperscheats.lol/builder/ex/) | [Stable 13.60 builder](https://sniperscheats.lol/builder/) | [Build and validation details](experimental/README.md) | [Credits](CREDITS.md)

This branch and its prereleases are separate from the stable 13.60 release. Every target passed local image and installer integration checks; **this experimental binary has not been validated on consoles across these firmwares**. Community reports should include firmware, selected payloads, the stage that failed and relevant logs with private data removed.

The native handoff owns the payloads before closing YouTube, retains the five-second dashboard wait, and waits for etaHEN/kstuff readiness before subsequent payloads. Installation needs an existing jailbreak and etaHEN. The installer chooses the matching YouTube package, verifies it and the startup image, and can reconcile a lost DPI reply against actual installation completion.

Source layout: `relapse-host` contains the builder, installer and payload supervisors; `relapse-y2jb` contains Y2JB/Relapse integration and UFS2 tools; `etahen-13.60` retains its historical directory name but contains the experimental multi-firmware source. `experimental` holds exact profiles, pinned research, build scripts, local integration results and isolated deployment examples.

The original 13.60 ten-run test is historical and does not establish compatibility of this experimental release. See [stable history](release/STABLE-HISTORY.md). Existing component credits and licenses remain in [CREDITS.md](CREDITS.md) and [LICENSES.md](LICENSES.md). Snipers' integration builds on the original exploit, etaHEN, payload and toolchain authors' work.
