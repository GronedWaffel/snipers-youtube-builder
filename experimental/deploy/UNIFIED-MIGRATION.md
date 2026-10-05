# Unified production migration

The unified deployment uses loopback port **8792**. Port 8791 was already occupied on this host; do not replace that listener. `snipers-youtube-unified.service` and `nginx-unified.conf` record the deployed configuration. Adjust host-specific runtime paths for another server.

The new service has independent job storage and the existing two-worker/100-session/20-minute policy. CPU quota, memory limits and idle I/O priority protect other services. The old stable and experimental services remain available for legacy job/download fallbacks. New build requests, including requests from old `/ex` pages, go to the unified service. Package aliases are served over HTTP and HTTPS for the native installer. Keep those aliases intact.

Deploy into a new immutable release directory. Verify every catalog payload hash, compile real bundles with the production runtime, and verify local health before changing Nginx. Save the old includes, virtual host and diagnostics UI; run `nginx -t` before reloading. The production migration preserved those backups under `/opt/snipers-youtube-unified/rollback-20261005`. Restore the saved configuration files, validate Nginx and reload to roll back routing; retain the new service while any newly issued installer URLs remain in use.

Checks completed: production 11.00/13.60 image and personalized installer builds, public etaHEN checksum, normal and `/ex` page routing, HTTP/HTTPS package byte ranges, excluded firmware rejection, diagnostic health, and Jellyfin health. Console compatibility remains scoped to the release's recorded hardware observations.
