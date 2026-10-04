<!-- snipers-experimental-release -->
**Experimental multi-firmware downloads:** [Open the release with ELF / Windows assets](https://github.com/GronedWaffel/snipers-youtube-builder/releases/tag/experimental-multifw-v1.3). Targets 33 exact firmware versions from 7.00 through 13.60; 9.05 and 11.40 excluded. Community testing is still required. Stable 13.60 remains separate. [Experimental builder](https://sniperscheats.lol/builder/ex/) · [Experimental payloads](https://sniperscheats.lol/payloads/ex/).
<!-- /snipers-experimental-release -->

# Snipers YouTube Builder

Build your own automatic YouTube homebrew startup for **PS5 firmware 13.60**. Choose hosted payloads or upload your own ELF files, install the selected bundle from the PS5 browser, then open YouTube after a reboot.

**[Open the builder](https://sniperscheats.lol/builder/)** · [Build instructions](BUILDING.md) · [Credits](CREDITS.md) · [Test results](TESTING.md)

A phone or PC is optional for choosing payloads. Installation runs on the PS5 with an existing jailbreak and etaHEN active. When the supported YouTube app is missing, the installer can request its installation through etaHEN DPI v2. Supported application: **PPSA01650, version 01.000.030**. Follow the website's network/DNS instructions.

After the kernel stage completes and cleans up, an independent native loader owns the selected payloads, closes YouTube, waits for its mounts to release, and gives the dashboard five seconds before starting etaHEN. The recommended chain waits for etaHEN Toolbox and kstuff readiness, then starts ShadowMountPlus and PS5Debug-NG. Failed startup stages stop the sequence rather than repeatedly injecting payloads.

## Tested configuration

On October 3, 2026, the maintainer reported **10 consecutive successful reboot-and-jailbreak runs on one PS5** using the ShellUI trace build, etaHEN, ShadowMountPlus, and PS5Debug-NG, with Display title IDs disabled. The exact payload and image hashes are recorded in [release/test-results.json](release/test-results.json).

This is an **experimental, unofficial integration**. Earlier testing encountered intermittent ShellUI/system-software errors, including one with title IDs disabled. The trace build adds diagnostics; a root-cause fix has not been established. Ten successful runs are the observed result, not a universal success-rate claim. Other payload combinations need their own testing.

## Source layout

- `relapse-host/builder`: website, selection service, native installer, readiness checks, and independent startup loader.
- `relapse-y2jb`: edisnord's Relapse Y2JB port, host integration, pinned Y2JB inputs, and UFS2 image builder.
- `etahen-13.60`: LightningMods' etaHEN with the unofficial 13.60 port and the diagnostic changes used in the ten-run test.
- `relapse-host/optional` and `relapse-host/vendor`: payload supervisors, modified ShadowMountPlus, and supporting source.

This release publishes source. SDKs, external build inputs, compiled payloads, and Sony application packages are not included. The public site's deployment is managed separately; the historical hosted catalog in this source pins etaHEN r3. Use `release/tested-selection.json` and the trace build instructions to reproduce the tested selection.

## Credit and licensing

The exploit, host, etaHEN, payloads, and toolchain are community work. Snipers contributes the builder, installation workflow, startup coordination, and documented integration changes. **Please retain the original authors' credits and licenses.** See [CREDITS.md](CREDITS.md) and [LICENSES.md](LICENSES.md).
