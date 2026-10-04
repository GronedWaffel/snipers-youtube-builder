"""Verify local package pieces and embedded metadata without network access.

Piece hashes establish agreement with the saved download manifest; they do
not verify Sony's cryptographic signature or installation on a console.
"""
import hashlib
import json
import pathlib
import struct

ROOT = pathlib.Path(__file__).resolve().parent
EXPECTED = {
    'titleId': 'PPSA01650',
    'contentVersion': '01.000.003',
    'contentId': 'UP4381-PPSA01650_00-YOUTUBESIEA00000',
    'requiredSystemSoftwareVersion': '0x0403000000000000',
}

def verify(data, manifest):
    if len(data) != manifest['originalFileSize']:
        raise ValueError('Package length mismatch')
    if len(manifest['pieces']) != manifest['numberOfSplitFiles']:
        raise ValueError('Piece count mismatch')
    offset = 0
    for piece in sorted(manifest['pieces'], key=lambda p: p['fileOffset']):
        size = piece['fileSize']
        if piece['fileOffset'] != offset or size <= 0 or offset + size > len(data):
            raise ValueError('Invalid piece extent')
        part = data[offset:offset+size]
        digest = piece['hashValue'].lower()
        algorithm = {40: hashlib.sha1, 64: hashlib.sha256}.get(len(digest))
        if algorithm is None or algorithm(part).hexdigest() != digest:
            raise ValueError('Piece checksum mismatch')
        offset += size
    if offset != len(data):
        raise ValueError('Unverified trailing data')

    # CNT layout: LibProsperoPKG/docs/ps5-pkg-format.md. Resolve the
    # active param.json entry (0x2000), not origin/target-param history.
    if data[:4] != b'\x7fFIH':
        raise ValueError('Missing finalized-image header')
    sc = struct.unpack_from('<Q', data, 0x58)[0]
    if sc + 0x5a0 > len(data) or data[sc:sc+4] != b'\x7fCNT':
        raise ValueError('Invalid metadata container')
    body_offset, body_size = struct.unpack_from('>QQ', data, sc + 0x20)
    sc_size = body_offset + body_size
    if body_offset < 0x5a0 or sc + sc_size > len(data):
        raise ValueError('Invalid metadata body extent')
    count = struct.unpack_from('>I', data, sc + 0x10)[0]
    table = struct.unpack_from('>I', data, sc + 0x18)[0]
    if not 1 <= count <= 4096 or table < 0x5a0 or table + count * 32 > sc_size:
        raise ValueError('Invalid metadata entry table')
    parameters = []
    for index in range(count):
        entry_id, _, flags, _, offset, size, _, _ = struct.unpack_from('>8I', data, sc + table + index * 32)
        if offset + size > sc_size:
            raise ValueError('Metadata entry outside container')
        if entry_id == 0x2000:
            if flags & 0x80000000 or not 1 <= size <= 65536:
                raise ValueError('Unreadable app metadata entry')
            parameters.append((sc + offset, size))
    if len(parameters) != 1:
        raise ValueError('Missing or ambiguous param.json entry')
    metadata_offset, metadata_size = parameters[0]
    metadata = json.loads(data[metadata_offset:metadata_offset+metadata_size].rstrip(b'\0'))
    if any(metadata.get(key) != value for key, value in EXPECTED.items()):
        raise ValueError('Unexpected app identity, version, or minimum firmware')
    return {
        'bytes': len(data),
        'sha256': hashlib.sha256(data).hexdigest(),
        'pieceChecksumsVerified': True,
        'metadataVerified': True,
        'metadataOffset': metadata_offset,
        'metadata': {key: metadata[key] for key in EXPECTED},
        'sonySignatureVerified': False,
        'consoleInstallVerified': False,
    }

if __name__ == '__main__':
    package = ROOT / 'local/packages/YouTube-PPSA01650-01.000.003.pkg'
    manifest = json.loads((ROOT / 'local/packages/youtube-003-manifest.json').read_text())
    result = verify(package.read_bytes(), manifest)
    record_path = ROOT / 'youtube-003.json'
    record = json.loads(record_path.read_text())
    if record['sha256'] != result['sha256']:
        raise ValueError('Previously recorded package checksum changed')
    record.update(result)
    record_path.write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps(result, indent=2))
