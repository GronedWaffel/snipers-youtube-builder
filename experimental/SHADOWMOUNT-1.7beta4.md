# ShadowMountPlus 1.7beta4 website update

The payload library and new YouTube bundles now use the official ShadowMountPlus 1.7beta4 ELF, embedded unchanged in the existing etaHEN readiness supervisor. Original authors: drakmor and the ShadowMountPlus contributors. [Release and source](https://github.com/drakmor/ShadowMountPlus/releases/tag/1.7beta4), GPLv3.

Upstream ELF: 2,475,496 bytes, SHA-256 `fc4e5f715e76660ce34bde2adb10eaf1d069cb2cdf06f7a380896dfb62bd0c4a`.
Supervised website ELF: 2,698,880 bytes, SHA-256 `9a8ebf680d5552b91b3e02aced38948a82d4119614429c14a6ada013d0d02847`.

The owner confirmed using beta4 throughout their 13.60 testing and reported it stable. This does not establish compatibility of every feature on every supported firmware. The upstream project still labels beta4 a prerelease. The wrapper retains duplicate-process/port detection, etaHEN readiness checks and startup result reporting.

Rebuild with `node relapse-host/scripts/build-optional.mjs --only=shadowmount` using the pinned upstream ELF at `relapse-host/vendor/shadowmountplus-1.7beta4.elf`. Update only the ShadowMount entry in `experimental/hosted-payloads.json`, then regenerate the payload hub. Existing bundles retain their embedded beta2 until rebuilt and installed. Old hashed downloads remain available during migration.
