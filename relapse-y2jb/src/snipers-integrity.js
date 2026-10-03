// SPDX-License-Identifier: MIT
// Full-image SHA-256 is checked during build and installation. Boot checks
// detect damaged payload bytes using pinned CRC32, size and ELF headers.
// CRC32 detects accidental corruption; it is not cryptographic authentication.
function snipersCrc32(data) {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let bit = 0; bit < 8; bit++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
        table[i] = c >>> 0;
    }
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) c = (c >>> 8) ^ table[(c ^ data[i]) & 255];
    return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}
