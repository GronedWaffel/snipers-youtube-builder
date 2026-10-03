# Component licenses

This is a collection of components, not a blanket relicensing of upstream work.

- Native installer, native startup integration, supervisors, and etaHEN modifications: GPL-3.0-or-later where marked; preserve the full [etaHEN GPL license](etahen-13.60/LICENSE) and in-file notices.
- Relapse / Relapse-Y2JB, Y2JB host, and JavaScript startup integration: MIT, with original copyright notices in [Relapse license](relapse-y2jb/LICENSE), [Y2JB license](relapse-y2jb/third_party/y2jb-host/LICENSE), and [browser runtime license](relapse-host/site/LICENSE).
- ShadowMountPlus and other vendored components retain their own licenses and notices.
- UFS2: BSD-2-Clause; see the vendored notices in `relapse-y2jb/tools/ufs2/vendor`.
- Separately obtained payloads and SDK dependencies retain their own licenses. PS5Debug-NG is GPL-3.0-only. See the detailed component credits before distributing linked binaries.

No Sony application package, credentials, console logs, or user uploads are distributed here. Upstream source headers may contain legacy embedded byte arrays; standalone compiled payload files are excluded.
