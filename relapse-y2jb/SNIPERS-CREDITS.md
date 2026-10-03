# Sources and credits

- Read-only `splash.html` packaging practice: documented in itsPLK's Y2JB
  autoloader v0.2.1 changelog and updater (`chmod 0444`). This build only uses
  that file-permission practice, not itsPLK's launcher or payload manager.
  https://github.com/itsPLK/ps5-y2jb-autoloader/blob/main/CHANGELOG.md

- Relapse Y2JB port: **edisnord**, MIT,
  https://github.com/edisnord/relapse-y2jb at
  `bcddec7de9ee5382b675cff30cbc7f21ad03af14`.
- Original kernel exploit and offsets: **ntfargo and credited Relapse contributors**,
  MIT, https://github.com/ntfargo/Relapse-Exploit at
  `dd8e4e0914c5e9d066ee1f9b056be76cb992c8e0`.
- Original YouTube host, kexp and ELF-loader bundle: **Gezine/Y2JB and its credited
  contributors**, https://github.com/Gezine/Y2JB at
  `79c1be475ef89d437ea52c6afd6dcb5e700d2875`. Original MIT host license and README
  are retained in `third_party/y2jb-host`. kexp is credited to ufm42; ELF loader
  work to John Tornblom, EchoStretch and contributors. Retain component licenses.
- etaHEN: **LightningMods and etaHEN contributors**, GPLv3, with GronedWaffel's
  unofficial 13.60 r3 port. Matching source/build inputs:
  https://github.com/GronedWaffel/etahen-13.60/releases/tag/v2.5B-13.60-r3
- ShadowMountPlus: **drakmor and contributors**, GPLv3; matched
  `1.7beta2-snipers1360-r2-y2jb`, packaged inside the guarded supervisor.
  This local revision adds the exact YouTube app-mount wait exemption. Matching
  source is in `relapse-host/vendor/ShadowMountPlus-1.7beta2`; build with
  `scripts/build-shadowmount-compat.mjs --y2jb-candidate` and
  `scripts/build-optional.mjs --y2jb-candidate` in that sibling project.
- PS5Debug-NG: **Pharaoh2k/OSR, CTN, SiSTR0 and contributors**, GPL-3.0-only,
  version 1.3.2, inside the existing guarded supervisor.
  https://github.com/Pharaoh2k/ps5debug-NG
- Supervisors: GronedWaffel host integration, GPL-3.0-or-later, based on
  **John Tornblom's libelfldr/libNineS and PS5 Payload SDK 0.43**. Source is
  retained in the sibling `relapse-host/optional` and `shortcut/syscall-shim.S`;
  preserve the matching SDK and payload sources when redistributing binaries.
- UFS2 image tool: **SvenGDK**, BSD-2-Clause, as vendored by pearlxcore's
  PS5PKGTool at `0072cb40584a2a4a7d6cf3a1b73e11617fa04e74` and already used in
  PS Neighborhood. Source/notices are retained in `tools/ufs2/vendor`.
- Startup orchestration, Windows packaging and SHA-256 fallback: GronedWaffel
  project integration, MIT. Native payloads retain their separate licenses.

This source snapshot is published by GronedWaffel. See the repository-root CREDITS.md and TESTING.md.
No Sony application package, console credentials, saves or game content is included.
