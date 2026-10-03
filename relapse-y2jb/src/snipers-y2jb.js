// SPDX-License-Identifier: MIT
// Native transport and post-cleanup Home navigation for Gezine Y2JB.
function createSnipersY2jbIO(logger) {
    const BAD = 0xffffffffffffffffn;
    const ARENA_SIZE = 0x14000n;
    // Large Y2JB malloc allocations can be tagged; use a real native mapping.
    const arena = syscall(477n, 0n, ARENA_SIZE, 3n, 0x1002n, BAD, 0n);
    if (arena === BAD || arena <= 0n || arena >= 0x800000000000n)
        throw new Error('Cannot allocate native startup buffers');
    const chunk = arena + 0x4000n;
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    let dashboardPrompt = null;
    // Payload buffers are 8-byte aligned native memory. Copy whole words;
    // upstream read_buffer/write_buffer perform a read/modify/write per byte.
    function readPayload(count) {
        const bytes = new Uint8Array(count), view = new DataView(bytes.buffer);
        let i = 0;
        for (; i + 8 <= count; i += 8) view.setBigUint64(i, read64(chunk + BigInt(i)), true);
        if (i < count) bytes.set(read_buffer(chunk + BigInt(i), BigInt(count - i)), i);
        return bytes;
    }
    function writePayload(bytes) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let i = 0;
        for (; i + 8 <= bytes.length; i += 8) write64(chunk + BigInt(i), view.getBigUint64(i, true));
        if (i < bytes.length) write_buffer(chunk + BigInt(i), bytes.subarray(i));
    }
    function failed(n) { return n < 0n || n === BAD; }
    function check(n, message) { if (n !== 0n) throw new Error(message); }
    function close(fd) { syscall(6n, fd); }
    function errno() {
        const errorPointer = call(libc_error);
        return Number(read32(errorPointer));
    }
    function address() {
        write_buffer(arena, new Uint8Array([16,2,0x23,0x3d,127,0,0,1,0,0,0,0,0,0,0,0]));
        return arena;
    }
    function socketTimeout(fd, option, seconds) {
        write64(arena + 32n, BigInt(seconds)); write64(arena + 40n, 0n);
        check(syscall(105n, fd, 0xffffn, option, arena + 32n, 16n), 'Cannot set socket timeout');
    }
    // Read-only diagnostics after jailbreak. Keep a bounded snapshot so a
    // truncated/recreated bootstrap log cannot silently hide the failed boot.
    const diagnosticPaths = ['/data/etaHEN/bootstrap-1360-port.log', '/data/kstuff_debug.log'];
    const diagnosticPrevious = new Map();
    let diagnosticNext = 0, diagnosticStarted = false;
    function mirrorDiagnostics(baseline = false) {
        if (!baseline && (!diagnosticStarted || Date.now() < diagnosticNext)) return;
        diagnosticStarted = true; diagnosticNext = Date.now() + 1000;
        for (const path of diagnosticPaths) {
            let fd = null;
            try {
                const name = new Uint8Array(path.length + 1);
                for (let i=0; i<path.length; i++) name[i] = path.charCodeAt(i);
                write_buffer(arena + 1024n, name);
                fd = syscall(5n, arena + 1024n, 0n);
                if (failed(fd)) { fd = null; if (baseline) diagnosticPrevious.set(path, ''); continue; }
                let text = '', total = 0;
                // A regular file, capped at 64 KiB; never wait on a device.
                while (total < 65536) {
                    const n = syscall(3n, fd, chunk, BigInt(65536-total));
                    if (failed(n) || n > BigInt(65536-total)) throw new Error('diagnostic read failed');
                    if (n === 0n) break;
                    const bytes = readPayload(Number(n)); total += bytes.length;
                    for (let i=0; i<bytes.length; i++) text += String.fromCharCode(bytes[i]);
                }
                const old = diagnosticPrevious.get(path) || '';
                diagnosticPrevious.set(path, text);
                if (baseline || text === old) continue;
                const added = text.startsWith(old) ? text.slice(old.length) : text;
                const lines = added.split(/\r?\n/).filter(Boolean);
                if (lines.length > 40) logger('[native log] ' + (lines.length-40) + ' earlier lines omitted');
                for (const line of lines.slice(-40)) logger('[' + path.split('/').pop() + '] ' + line.slice(0,500));
                if (total === 65536) logger('[native log] Capture limit reached for ' + path);
            } catch (_) {
                // Diagnostics must not change payload loading or retry behavior.
            } finally { if (fd !== null) close(fd); }
        }
    }
    function openBundled(name) {
        if (!/^[a-zA-Z0-9_.-]+$/.test(name) || name === '.' || name === '..')
            throw new Error('Invalid bundled filename');
        const cache = 'download0/cache/splash_screen/aHR0cHM6Ly93d3cueW91dHViZS5jb20vdHY=/';
        // Preflight runs before the sandbox escape. The framework's find_file
        // only searches the external /mnt/sandbox mount names.
        const paths = ['/' + cache + name, cache + name];
        if (typeof TITLE_ID === 'string' && /^PPSA\d{5}$/.test(TITLE_ID))
            for (const slot of ['000','001','002']) paths.push('/mnt/sandbox/' + TITLE_ID + '_' + slot + '/' + cache + name);
        const errors = [];
        for (const path of paths) {
            // Keep syscall strings in canonical native memory, just like the
            // read buffers. Do not depend on V8-backed alloc_string pointers.
            const bytes = new Uint8Array(path.length + 1);
            for (let i = 0; i < path.length; i++) bytes[i] = path.charCodeAt(i);
            if (bytes.length > 3072) throw new Error('Bundled path too long');
            write_buffer(arena + 1024n, bytes);
            const fd = syscall(5n, arena + 1024n, 0n);
            if (!failed(fd)) { logger('Reading ' + path); return fd; }
            errors.push(path + ' (errno ' + errno() + ')');
        }
        for (const detail of errors) logger('File lookup: ' + detail);
        throw new Error('Cannot open bundled file: ' + name + '; see file lookup errors');
    }
    return {
        log: logger,
        notify: text => send_notification(text),
        async returnHome() {
            logger('Manual Home: hold PS; keep YouTube running. etaHEN starts in 10 seconds.');
            try {
                if (typeof document !== 'undefined') dashboardPrompt=showSnipersDashboardPrompt(document,window.innerWidth);
            } catch (error) { logger('Dashboard banner unavailable: '+error.message); }
            send_notification('GO TO DASHBOARD NOW\nHold PS. Keep YouTube running.');
            for(let remaining=10;remaining>0;remaining--) {
                if(dashboardPrompt)dashboardPrompt.update(remaining);
                await pause(1000);
            }
            if(dashboardPrompt)dashboardPrompt.update(0);
        },
        verify: (data, item) => /^[0-9a-f]{8}$/.test(item.crc32 || '') && snipersCrc32(data) === item.crc32,
        async read(item) {
            const started = Date.now(); let nextLog = started + 3000;
            const fd = openBundled(item.file);
            try {
                check(syscall(189n, fd, arena + 256n), 'Cannot stat ' + item.file);
                if (read64(arena + 256n + 72n) !== BigInt(item.bytes))
                    throw new Error('Wrong size: ' + item.file);
                const data = new Uint8Array(item.bytes);
                let offset = 0;
                while (offset < data.length) {
                    const count = Math.min(65536, data.length - offset);
                    const n = syscall(3n, fd, chunk, BigInt(count));
                    if (failed(n) || n === 0n || n > BigInt(count)) throw new Error('Incomplete file: ' + item.file);
                    data.set(readPayload(Number(n)), offset); offset += Number(n);
                    if (Date.now() >= nextLog) {
                        logger('Reading ' + item.label + ': ' + Math.floor(100 * offset / data.length) + '%');
                        nextLog = Date.now() + 3000;
                    }
                    await pause(0);
                }
                logger('Read ' + item.label + ' in ' + (Date.now() - started) + ' ms');
                return data;
            } finally { close(fd); }
        },
        async send(item, data) {
            if (item.id === 'etahen') mirrorDiagnostics(true);
            for (let attempt = 0; attempt < 40; attempt++) {
                const fd = syscall(97n, 2n, 1n, 0n);
                if (failed(fd)) throw new Error('Cannot create payload socket');
                try {
                    socketTimeout(fd, 0x1005n, 5);
                    socketTimeout(fd, 0x1006n, 1);
                    const connected = syscall(98n, fd, address(), 16n);
                    if (connected !== 0n) {
                        if (errno() !== 61) throw new Error('ELF loader connection failed; no retry');
                    } else {
                        for (let offset = 0; offset < data.length;) {
                            const count = Math.min(65536, data.length - offset);
                            writePayload(data.subarray(offset, offset + count));
                            let sent = 0;
                            while (sent < count) {
                                const n = syscall(133n, fd, chunk + BigInt(sent), BigInt(count-sent), 0x20000n, 0n, 0n);
                                if (failed(n) || n === 0n || n > BigInt(count-sent))
                                    throw new Error(item.label + ': interrupted transfer; reboot before retrying');
                                sent += Number(n);
                            }
                            offset += count;
                            await pause(0);
                        }
                        check(syscall(134n, fd, 1n), 'Cannot finish payload input');
                        if (item.id === 'etahen') {
                            logger('etaHEN sent. ShadowMount supervisor will wait for the current Toolbox startup.');
                            return {sent:true};
                        }
                        const deadline = Date.now() + 150000;
                        let text = '', progressOffset = 0, nextLog = Date.now() + 5000;
                        while (Date.now() < deadline && text.length < 32768) {
                            mirrorDiagnostics();
                            write32(arena + 64n, fd); write16(arena + 68n, 1n); write16(arena + 70n, 0n);
                            const ready = syscall(209n, arena + 64n, 1n, 0n);
                            if (failed(ready)) throw new Error('Cannot poll payload acknowledgement');
                            if (ready === 0n) {
                                if (Date.now() >= nextLog) { logger('Waiting for ' + item.label + ' readiness...'); nextLog = Date.now()+5000; }
                                await pause(100); continue;
                            }
                            if (!(Number(read16(arena + 70n)) & 1)) break;
                            const n = syscall(3n, fd, chunk, 512n);
                            if (failed(n) || n === 0n || n > 512n) break;
                            const bytes = read_buffer(chunk, n);
                            for (let i=0; i<bytes.length; i++) text += String.fromCharCode(bytes[i]);
                            let end;
                            while ((end = text.indexOf('\n', progressOffset)) >= 0) {
                                const line = text.slice(progressOffset, end).replace(/\r$/, '');
                                if (line.startsWith('SNPR_OPTION_PROGRESS=')) logger(line.slice(21));
                                progressOffset = end + 1;
                            }
                            const result = /SNPR_OPTION_RESULT=(-?\d+)\r?\n/.exec(text);
                            if (result) {
                                const message = /SNPR_OPTION_MESSAGE=([^\r\n]+)/.exec(text);
                                const code = Number(result[1]);
                                if (code !== 0 && code !== 1) throw new Error(message ? message[1] : item.label + ' startup failed');
                                if (message) logger(message[1]);
                                return {code};
                            }
                        }
                        throw new Error(item.label + ': no completion acknowledgement; not retried');
                    }
                } finally { close(fd); }
                await pause(500);
            }
            throw new Error('ELF loader did not become ready');
        },
        dispose() { if(dashboardPrompt)dashboardPrompt.remove(); syscall(73n, arena, ARENA_SIZE); }
    };
}
