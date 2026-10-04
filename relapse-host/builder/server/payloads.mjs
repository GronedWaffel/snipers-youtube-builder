import {createHash, randomBytes} from 'node:crypto';
import fs from 'node:fs';
export const LIMITS = Object.freeze({files: 8, fileBytes: 64 * 1024 ** 2, totalBytes: 128 * 1024 ** 2});
export const RECOMMENDED = Object.freeze(['etahen','shadowmount','debug']);
export const HOSTED = Object.freeze(JSON.parse(fs.readFileSync(new URL('../../../experimental/hosted-payloads.json',import.meta.url),'utf8')));
export const publicCatalog = () => HOSTED.map(({input, acknowledgement, ...item}) => item);
export const newToken = () => randomBytes(24).toString('hex');
export const isToken = value => typeof value === 'string' && /^[a-f0-9]{48}$/.test(value);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function displayName(value) {
  // Relative directory names never become server paths or FTP commands.
  const name = String(value || '').replaceAll('\\', '/').split('/').at(-1).normalize('NFC');
  if (!name || name === '.' || name === '..' || /[\x00-\x1f\x7f]/.test(name) || Buffer.byteLength(name) > 180)
    throw Error('Choose a payload with a name shorter than 180 bytes and no control characters.');
  if (!/\.(elf|bin)$/i.test(name)) throw Error('Payloads must be ELF files (.elf or .bin).');
  return name;
}

export function inspectPayload(data) {
  if (!Buffer.isBuffer(data) || data.length < 64 || data.length > LIMITS.fileBytes)
    throw Error('Payload must be between 64 bytes and 64 MiB.');
  if (data.readUInt32LE() !== 0x464c457f || data[4] !== 2 || data[5] !== 1 || data[6] !== 1 ||
      data.readUInt16LE(18) !== 62 || ![2, 3].includes(data.readUInt16LE(16)))
    throw Error('Expected a 64-bit x86 ELF payload, not a PKG, archive, or SELF.');
  if (data.readUInt16LE(52) !== 64 || data.readUInt16LE(54) !== 56)
    throw Error('Unsupported ELF header layout.');
  const offset = data.readBigUInt64LE(32), count = data.readUInt16LE(56);
  if (!count || count > 128 || offset < 64n || offset + BigInt(count * 56) > BigInt(data.length))
    throw Error('Incomplete ELF program headers.');
  let loads = 0, executable = false, memory = 0n;
  const entry = data.readBigUInt64LE(24);
  for (let i = 0; i < count; i++) {
    const at = Number(offset) + i * 56, type = data.readUInt32LE(at);
    const pos = data.readBigUInt64LE(at + 8), address = data.readBigUInt64LE(at + 16);
    const size = data.readBigUInt64LE(at + 32), mem = data.readBigUInt64LE(at + 40);
    if (size && pos + size > BigInt(data.length)) throw Error('Truncated ELF segment.');
    if (type !== 1) continue;
    if (size > mem || address + mem > 0x800000000000n) throw Error('Invalid ELF memory layout.');
    memory += mem; loads++;
    if ((data.readUInt32LE(at + 4) & 1) && entry >= address && entry < address + mem) executable = true;
  }
  if (!loads || !executable || memory > 512n * 1024n ** 2n) throw Error('Invalid ELF entry point or excessive memory requirement.');
  // Structural validity does not certify firmware compatibility or behavior.
  return {bytes: data.length, sha256: sha256(data)};
}

export function validateSelection(selection, uploads = []) {
  if (!Array.isArray(selection) || !selection.length || selection.length > LIMITS.files)
    throw Error('Choose between 1 and 8 payloads.');
  const available = new Map([...HOSTED, ...uploads].map(item => [item.id, item]));
  const seen = new Set(), hashes = new Set(); let bytes = 0;
  const result = selection.map(id => {
    const item = typeof id === 'string' && available.get(id);
    if (!item || seen.has(id)) throw Error('The selection contains a missing or repeated payload.');
    if (hashes.has(item.sha256)) throw Error('The same payload was selected more than once.');
    for (const required of item.requires || []) if (!seen.has(required)) throw Error(item.label + ' requires etaHEN earlier in the startup order.');
    if (id === 'etahen' && seen.size) throw Error('etaHEN must run first.');
    seen.add(id); hashes.add(item.sha256); bytes += item.bytes;
    return {...item};
  });
  if (bytes > LIMITS.totalBytes) throw Error('Combined payloads must not exceed 128 MiB.');
  return result;
}
