// SPDX-License-Identifier: MIT
// Called only after the startup controller confirms Relapse cleanup.
async function snipersReturnHome(native, log, notify, pause) {
    let accepted = false;
    try {
        const home = native.resolve('sceSystemServiceNavigateToGoHome');
        const foreground = native.resolve('sceUserServiceGetForegroundUser');
        if (!home || !foreground) throw Error('Home services unavailable');
        const user = native.foregroundUser(foreground);
        if (!Number.isInteger(user) || user < 0 || user === 0x7fffffff)
            throw Error('No foreground user');
        // Inspected on 13.60: this wrapper jumps to ShellCoreUtil GoHome,
        // which serializes its first int argument as userId (not a void ABI).
        const result = BigInt.asIntN(32, native.call(home, BigInt(user)));
        if (result !== 0n) throw Error('Home request returned ' + result);
        accepted = true;
        log('Home request accepted; keeping YouTube running.');
    } catch (error) {
        log('Automatic Home unavailable: ' + error.message);
    }
    if (accepted) {
        notify('Relapse complete. Returning Home...\nStarting etaHEN.');
        await pause(1500);
    } else {
        notify('Hold PS to return Home. Keep YouTube running.\netaHEN starts in 10 seconds.');
        await pause(10000);
    }
    return accepted;
}
