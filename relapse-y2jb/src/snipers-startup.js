// SPDX-License-Identifier: MIT
// GronedWaffel's post-Relapse sequence. No exploit or kernel offsets here.
function createSnipersStartup(io, manifest) {
    let attempted = false;
    let verified = null;
    return {
        async prepare(firmware) {
            if (firmware !== '13.60') throw new Error('This payload set requires PS5 13.60');
            if (manifest.map(x => x.id).join(',') !== 'etahen,shadowmount,debug')
                throw new Error('Unexpected startup sequence');
            const files = [];
            for (const item of manifest) {
                io.log('Checking ' + item.label + ' before Relapse starts...');
                const data = await io.read(item);
                const started = Date.now();
                if (!(data instanceof Uint8Array) || data.length !== item.bytes ||
                    data[0] !== 0x7f || data[1] !== 0x45 || data[2] !== 0x4c || data[3] !== 0x46 ||
                    data[4] !== 2 || data[5] !== 1 || data[18] !== 62 || data[19] !== 0 ||
                    !(await io.verify(data, item)))
                    throw new Error(item.label + ': missing, incomplete or incorrect ELF');
                files.push({item, data});
                io.log('Verified ' + item.label + ' (integrity check ' + (Date.now() - started) + ' ms)');
            }
            verified = files;
            return files;
        },
        async run(files, state) {
            if (!verified || files !== verified) throw new Error('Payloads were not verified');
            if (!state || !state.handedOff || !state.disarmed || state.crossed)
                throw new Error('Relapse did not confirm loader handoff and pipe cleanup; no payloads sent');
            if (attempted) throw new Error('Startup was already attempted; reboot before retrying');
            attempted = true;
            await io.returnHome();
            for (const entry of files) {
                io.log('Starting ' + entry.item.label + '...');
                const started = Date.now();
                const result = await io.send(entry.item, entry.data);
                if (entry.item.id !== 'etahen' && (!result || (result.code !== 0 && result.code !== 1)))
                    throw new Error(entry.item.label + ': readiness was not confirmed; sequence stopped');
                entry.data = null;
                io.log(entry.item.label + ': transfer/startup step finished in ' + (Date.now() - started) + ' ms');
            }
            io.log('Startup confirmed: etaHEN ready, ShadowMount ready, PS5Debug ready.');
            io.notify('Snipers startup complete\netaHEN + ShadowMount + PS5Debug');
        },
        dispose() {
            if (verified) for (const entry of verified) entry.data = null;
            verified = null;
            io.dispose();
        }
    };
}
