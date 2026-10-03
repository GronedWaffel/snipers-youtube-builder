# ShadowMountPlus 1.7beta2-snipers1360-r1

Based on drakmor's ShadowMountPlus 1.7beta2. Upstream license, credits,
documentation and donation links are retained. This is an unofficial integration
build for GronedWaffel's etaHEN 13.60 port, not an upstream release.

On 13.60, `sm_kstuff_init` leaves the legacy pause controller inactive and the
tag-write boundary refuses writes. Our bundled EchoStretch kstuff-lite v1.11
uses INT3 entries in copied syscall tables; the old `0xdeb7`/`0xffff` pointer-tag
toggle does not pause those hooks. Kstuff stays active. Mounting and KEKCALL
services remain intact. Other firmware's legacy controller is unchanged.

The host's build script adds its existing SDK syscall-gate shim and identifies
this build as `1.7beta2-snipers1360-r1`. See the sibling etaHEN repository's
`KSTUFF-SHADOWMOUNT-COMPATIBILITY.md` for the source evidence and test scope.

Build from the `relapse-host` directory with
`node scripts/build-shadowmount-compat.mjs`; it writes only to
`artifacts/candidates`. `node scripts/build-optional.mjs --compat-candidate`
then builds the host supervisor without replacing live site assets.

Dependencies: PS5 Payload SDK 0.43, Zig 0.14.1, and the official
`ps5-payload-dev/pacbrew-repo` v0.40.3 `ps5-payload-dev.tar.gz` bundle. Its
SHA-256 is `0d71dd90c4ad6ef562923be0eb87ca8ce47825b6a2f209e04bb5d57d3359aee8`.
Place it under `artifacts/shadowmount-build/dependencies` and extract the
`target/user/homebrew` json-c, libmicrohttpd, libpng16, zlib, sqlite and openlibm
headers/static libraries preserving the archive's `opt/ps5-payload-sdk` prefix.
The script uses `include/libpng16` directly so Windows needs no header symlinks.
Extract SDK 0.43's `sdk-0.43/sce_stubs/libkernel_sys.c` under the same dependencies
directory from the upstream SDK source archive. All archive URLs, exact hashes
and output hashes are recorded in the generated manifests.
