**[Unified release and source](https://github.com/GronedWaffel/snipers-youtube-builder/releases/tag/v2.0.0)**

# Snipers YouTube Builder — PS5 11.00–13.60

Create a YouTube startup bundle for 14 exact PS5 firmware targets from 11.00 through 13.60. **11.40 and firmware below 11.00 are excluded.** Choose hosted payloads or your own ELF files directly on PS5, or optionally from a phone/computer.

[Open the builder](https://sniperscheats.lol/builder/) | [Payload downloads](https://sniperscheats.lol/payloads/) | [Build and validation details](experimental/README.md) | [Credits](CREDITS.md)

The experimental line is merged into main. New bundles include the exact user-tested etaHEN Unified r1 ELF, with PS4/PS5 FPS display, plugins, Toolbox placement and the controller startup fix. Existing YouTube installations do not update themselves: rebuild and install a new bundle. Firmware-specific feature testing remains scoped; see the etaHEN release notes.

The native handoff owns the payloads before closing YouTube, retains the five-second dashboard wait, and waits for etaHEN/kstuff readiness before subsequent payloads. Installation needs an existing jailbreak and etaHEN. The installer chooses the matching YouTube package, verifies it and the startup image, and can reconcile a lost DPI reply against actual installation completion.

Source layout: `relapse-host` contains the builder, installer and payload supervisors; `relapse-y2jb` contains Y2JB/Relapse integration and UFS2 tools; `etahen-13.60` retains its historical directory name but contains the unified source. `experimental` holds exact profiles, pinned research, build scripts, local integration results and deployment examples.

The original 13.60 ten-run test is historical and does not establish compatibility of this experimental release. See [stable history](release/STABLE-HISTORY.md). Existing component credits and licenses remain in [CREDITS.md](CREDITS.md) and [LICENSES.md](LICENSES.md). Snipers' integration builds on the original exploit, etaHEN, payload and toolchain authors' work.
