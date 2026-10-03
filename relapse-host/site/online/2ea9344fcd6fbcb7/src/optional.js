import {OPTIONAL_PAYLOADS} from './optional-manifest.js';
import {sha256Hex} from './sha256.js';
import {sendLocalElf} from './autoload.js';

// Validate every selected payload before starting the jailbreak, including offline.
// Canonical order is intentional: mounting first, debugger second. No retries.
export async function prepareOptional(ids = [], fetcher = fetch, send = sendLocalElf) {
  if (!Array.isArray(ids) || ids.some(id => !OPTIONAL_PAYLOADS.some(p => p.id === id)))
    throw new Error('Unknown optional payload selection. Refresh the host.');
  const selected = OPTIONAL_PAYLOADS.filter(item => ids.includes(item.id));
  const prepared = [];
  for (const item of selected) {
    const response = await fetcher(item.path);
    if (!response.ok) throw new Error(item.label + ' is unavailable. Reconnect and finish saving the offline cache.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== item.bytes || sha256Hex(bytes) !== item.sha256)
      throw new Error(item.label + ' checksum mismatch. Refresh before starting.');
    prepared.push({item, bytes});
  }
  return async (p, chain, log) => {
    for (const {item, bytes} of prepared) {
      log('Checking etaHEN readiness and existing services for ' + item.label + '…', 'info');
      await send(p, chain, log, bytes, {label: item.label, completion: 'optional'});
    }
  };
}
