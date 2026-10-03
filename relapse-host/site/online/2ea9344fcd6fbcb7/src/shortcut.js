import {SHORTCUTS} from './shortcut-manifest.js';
import {sha256Hex} from './sha256.js';
import {sendLocalElf} from './autoload.js';
export async function prepareShortcut(hostname = location.hostname, fetcher = fetch) {
  if (!['manuals.playstation.net', 'sniperscheats.lol'].includes(hostname)) throw Error('Media shortcut is available only on the official host or its User\'s Guide address.');
  const entry = SHORTCUTS[hostname === 'manuals.playstation.net' ? 'guide' : 'site'];
  const response = await fetcher(entry.path);
  if (!response.ok) throw Error('Shortcut installer is unavailable. Reconnect and save the offline cache.');
  const payload = new Uint8Array(await response.arrayBuffer());
  if (payload.length !== entry.bytes || sha256Hex(payload) !== entry.sha256) throw Error('Shortcut installer checksum mismatch.');
  return (p, chain, log) => sendLocalElf(p, chain, log, payload, {label: 'Media shortcut installer', completion: true});
}
