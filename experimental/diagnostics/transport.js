// SPDX-License-Identifier: GPL-3.0-or-later
// Diagnostic stream transport derived from the existing local ELF loader.
const SOCKET=97, CONNECT=98, SETSOCKOPT=105, SENDTO=133, CLOSE=6;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function zero(result) { return result.low === 0 && result.hi === 0; }
function failed(result) { return result.hi === 0xffffffff || result.low === 0xffffffff; }

export async function sendLocalElf(p, chain, log, payload, {label = 'etaHEN', completion = false, completionTimeoutMs, delay = sleep, now = Date.now, onLine = () => {}} = {}) {
  if (!(payload instanceof Uint8Array) || payload.length < 64 || payload.length > 40 * 1024 * 1024 ||
      payload[0] !== 0x7f || payload[1] !== 0x45 || payload[2] !== 0x4c || payload[3] !== 0x46)
    throw new Error('A verified etaHEN ELF must be prepared before starting.');
  const address = p.malloc(16, 1);
  const bytes = [16, 2, 0x23, 0x3d, 127, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  bytes.forEach((value, index) => p.write1(address.add32(index), value));
  const timeout = p.malloc(16, 1);
  p.write8(timeout, 5); p.write8(timeout.add32(8), 0);
  const chunkSize = 64 * 1024;
  const data = p.malloc(chunkSize, 1);
  if (!(data.backing instanceof Uint8Array) || data.backing.length < chunkSize)
    throw new Error('Payload transfer buffer is unavailable.');
  log('Waiting for the ELF loader…', 'info');
  for (let attempt = 0; attempt < 20; attempt++) {
    const socket = await chain.syscall(SOCKET, 2, 1, 0);
    if (failed(socket) || socket.hi !== 0 || socket.low > 65535) throw new Error('Cannot open the payload connection.');
    const fd = socket.low;
    try {
      const option = await chain.syscall(SETSOCKOPT, fd, 0xffff, 0x1005, timeout, 16);
      if (!zero(option)) throw new Error('Cannot set the payload connection timeout.');
      const result = await chain.syscall(CONNECT, fd, address, 16);
      if (zero(result)) {
        log('Sending saved ' + label + ' to the local loader…', 'info');
        for (let offset = 0; offset < payload.length; offset += chunkSize) {
          const chunk = payload.subarray(offset, offset + chunkSize);
          data.backing.set(chunk);
          let sent = 0;
          while (sent < chunk.length) {
            const n = await chain.syscall(SENDTO, fd, data.add32(sent), chunk.length - sent, 0x20000, 0, 0);
            if (failed(n) || n.hi !== 0 || n.low === 0 || n.low > chunk.length - sent)
              throw new Error('Payload transfer interrupted. Restart before trying again.');
            sent += n.low;
          }
        }
        if (completion) {
          // Half-close input, keep output open for the installer's explicit result.
          if (!zero(await chain.syscall(134, fd, 1))) throw new Error('Shortcut connection could not finish sending.');
          if (!zero(await chain.syscall(SETSOCKOPT, fd, 0xffff, 0x1006, timeout, 16))) throw new Error('Shortcut response timeout could not be set.');
          const optional = completion === 'optional';
          const reply = p.malloc(8192, 1), pollfd = p.malloc(8, 1);
          // pollfd: int fd, short events, short revents. Poll without blocking
          // the ROP worker; a quiet socket is not a failed installation.
          const pollView = new DataView(pollfd.backing.buffer, pollfd.backing.byteOffset, 8);
          pollView.setInt32(0, fd, true); pollView.setInt16(4, 1, true);
          const waitMs = Number.isInteger(completionTimeoutMs) && completionTimeoutMs >= 1000 && completionTimeoutMs <= 1200000 ? completionTimeoutMs : (optional ? 150000 : 120000);
          const deadline = now() + waitMs;
          let nextProgress = now() + 5000;
          let text = '', progressOffset = 0, received = 0;
          while (received < 12 * 1024 * 1024 && now() < deadline) {
            pollView.setInt16(6, 0, true);
            const available = await chain.syscall(209, pollfd, 1, 0);
            if (failed(available) || available.hi !== 0 || available.low > 1) break;
            if (available.low === 0) {
              if (now() >= nextProgress) { log('Waiting for ' + label + ' to confirm completion…', 'info'); nextProgress = now() + 5000; }
              await delay(100);
              continue;
            }
            const events = pollView.getUint16(6, true);
            if (!(events & 1)) break; // HUP/ERR without readable data.
            const n = await chain.syscall(3, fd, reply, 8192);
            if (failed(n) || n.hi !== 0 || n.low === 0 || n.low > 8192) break;
            received += n.low;
            text += String.fromCharCode(...reply.backing.subarray(0,n.low));
            // Native progress can span socket reads. Show each complete line once.
            let lineEnd;
            while ((lineEnd = text.indexOf('\n', progressOffset)) !== -1) {
              const line = text.slice(progressOffset, lineEnd).replace(/\r$/, '');
              progressOffset = lineEnd + 1;
              onLine(line);
              if (optional && line.startsWith('SNPR_OPTION_PROGRESS=')) {
                log(line.slice('SNPR_OPTION_PROGRESS='.length), 'info');
                nextProgress = now() + 15000;
              }
            }
            const match = (optional ? /SNPR_OPTION_RESULT=(-?\d+)\r?\n/ : /SNPR_CARD_RESULT=(-?\d+)\r?\n/).exec(text);
            if (match) {
              if (optional) {
                const message = /SNPR_OPTION_MESSAGE=([^\r\n]+)/.exec(text)?.[1] || label + ': no details returned';
                if (match[1] !== '0' && match[1] !== '1') throw new Error(message);
                log(message, 'success');
                return {code: Number(match[1]), message};
              }
              if (match[1] !== '0') throw new Error('Media shortcut installation failed. The existing card was not claimed as installed.');
              log('Snipers PS5 Host shortcut is installed in Media.', 'success');
              return;
            }
            if(text.length > 16384){text=text.slice(progressOffset);progressOffset=0;}
          }
          throw new Error((optional ? label : 'Media shortcut') + ' did not confirm completion. It may have finished; it was not retried.');
        }
        log(label + ' sent from the browser to the local loader. Watch for its notification.', 'success');
        return;
      }
    } finally {
      await chain.syscall(CLOSE, fd);
    }
    await delay(500);
  }
  throw new Error('The ELF loader did not become ready. Restart before trying again.');
}
