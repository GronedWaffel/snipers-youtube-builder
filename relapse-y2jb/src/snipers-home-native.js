// SPDX-License-Identifier: MIT
// PS5 13.60 libkernel.sprx and service exports, inspected on the user's console.
// Module bases are discovered each run; no ASLR address or handle is pinned.
function snipersFindHome1360(n, log) {
    const valid = p => typeof p === 'bigint' && p > 0n && p < 0x800000000000n;
    function checked(base, offset, hex) {
        const address = base + offset;
        if (!valid(base) || !valid(address)) throw Error('Invalid Home module address');
        const bytes = n.read_buffer(address, BigInt(hex.length/2));
        for (let i=0; i<hex.length/2; i++)
            if (bytes[i] !== parseInt(hex.slice(i*2,i*2+2),16))
                throw Error('Home function fingerprint mismatch at offset ' + offset.toString(16));
        return address;
    }
    const list = checked(n.base,0x35d50n,'554889e541574156534883ec684889d34989f64989ffe8d53affff83f8017512');
    const info = checked(n.base,0x35e70n,'554889e54156534883ec704889f34189fee8ba39ffff83f8017512488b3d4e63');
    const handles=n.arena+0x1000n, record=n.arena+0x2000n, actual=n.arena+0x3000n;
    n.write64(actual,0n);
    const result=n.call(list,handles,0x300n,actual);
    if (BigInt.asIntN(32,result)!==0n) throw Error('Home module list returned '+result);
    const count=n.read64(actual);
    if (count<1n || count>0x300n) throw Error('Invalid Home module count');
    const found={};
    for(let i=0n;i<count;i++) {
        n.clear(record,0x160);n.write64(record,0x160n);
        if(BigInt.asIntN(32,n.call(info,n.read32(handles+i*4n),record))!==0n) continue;
        const text=n.read_buffer(record+8n,256n);let name='';
        for(let j=0;j<text.length && text[j];j++)name+=String.fromCharCode(text[j]);
        name=name.replace(/\.sprx$/,'');
        const base=n.read64(record+0x108n);
        if(name==='libSceSystemService'||name==='SceSystemService') {
            found.sceSystemServiceNavigateToGoHome=checked(base,0x1b30n,'e99b0d0100cccccccccccccccccccccce99b0e0100cccccccccccccccccccccc');
            log('Home SystemService verified');
        }
        if(name==='libSceUserService'||name==='SceUserService') {
            found.sceUserServiceGetForegroundUser=checked(base,0x3130n,'ff2592910100ccccccccccccccccccccff258a910100cccccccccccccccccccc');
            log('Home UserService verified');
        }
        if(found.sceSystemServiceNavigateToGoHome&&found.sceUserServiceGetForegroundUser) return found;
    }
    throw Error('Home service modules missing from '+count+' loaded modules');
}
