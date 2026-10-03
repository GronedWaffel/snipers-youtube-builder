export function rejection(userAgent) {
  const match = /PlayStation 5\/(\d+\.\d+)/.exec(userAgent);
  if (!match) return 'Open this page on your PS5 running firmware 13.60.';
  if (match[1] !== '13.60') return 'This host is for PS5 13.60 only. Detected ' + match[1] + '.';
  return null;
}

export function createStartAction({userAgent, run, update}) {
  let started = false;
  return async function start() {
    const reason = rejection(userAgent);
    if (reason) { update('blocked', reason); return; }
    if (started) return;
    started = true;
    update('running', 'Starting… keep this page open.');
    try {
      const result = await run();
      update('sent', result?.warning || 'etaHEN requested. Wait for its notification on the PS5.');
    } catch (error) {
      update('failed', error instanceof Error ? error.message : String(error));
      // A partial run may already have started a payload. Never auto-retry.
    }
  };
}
