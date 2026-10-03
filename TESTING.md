# Validation record

## Console result reported October 3, 2026

The maintainer completed **10 consecutive successful reboot-and-jailbreak runs** on one PS5 with firmware 13.60 and YouTube PPSA01650 01.000.030.

Configuration: etaHEN ShellUI trace diagnostic, bundled kstuff-lite v1.11, ShadowMountPlus 1.7beta2 Snipers Y2JB r2, PS5Debug-NG 1.3.2, and `Display_tids=0`. The independent loader closes YouTube and retains the five-second dashboard wait. Exact hashes are in `release/test-results.json` and `release/tested-selection.json`.

The result is maintainer-reported console testing, not ten independently instrumented boot transcripts. Earlier iterations had intermittent ShellUI freezes and CE-108262-9 errors, both before Toolbox readiness and after initialization. A failure also occurred with title IDs disabled. The trace build does not establish a root-cause fix. No broader firmware, console population, rest-mode, or arbitrary payload-combination success rate is claimed.

The earlier website workflow was also tested for download verification, installation, and a fresh YouTube install. Those checks were separate from this ten-run startup sequence.

## Local checks

The trace build compiled successfully; 11 etaHEN checks passed before installation. The UFS2 builder checked all ten packaged files against their source hashes. After installation, the complete startup image was independently read back over FTP and matched its local SHA-256. The backup's original ten bundle files also matched, with ordinary additional cache files present.

Release preparation passed all 35 builder checks in the working project, plus 30 source-only builder checks and all 11 etaHEN checks from the exported source. Five builder checks require compiled installer/native artifacts and were covered in the working project. Tests involving native binaries require the documented external dependencies and built artifacts; source-only tests can run without a console. No live-console tests run automatically from this repository.
