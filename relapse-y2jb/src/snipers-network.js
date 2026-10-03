// SPDX-License-Identifier: MIT
// Retry only interface discovery, never the kernel exploit or payload delivery.
async function waitForSnipersInterface(read, log, clock = {
    now: () => Date.now(), pause: ms => new Promise(resolve => setTimeout(resolve, ms))
}) {
    const start = clock.now();
    for (let attempt = 0; attempt <= 60; attempt++) {
        const address = await read();
        if (address && address.length === 4 && address.every(x => Number.isInteger(x) && x >= 0 && x <= 255) && address.some(x => x !== 0)) {
            log('LAN address ready: ' + address.join('.') + ' (' + (clock.now() - start) + ' ms)');
            return address;
        }
        if (attempt === 60 || clock.now() - start >= 60000) break;
        if (attempt % 5 === 0)
            log('Waiting for a LAN address (' + Math.floor((clock.now() - start) / 1000) + 's). Keep the network enabled; internet access is not required.');
        await clock.pause(Math.min(1000, 60000 - (clock.now() - start)));
    }
    throw new Error('No LAN address after 60s. Enable the network and check the LAN connection/IP address. No kernel exploit retry was attempted.');
}
