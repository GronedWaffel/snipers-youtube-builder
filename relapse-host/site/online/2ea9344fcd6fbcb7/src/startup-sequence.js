// The optional home-screen card must not prevent the selected payloads loading.
export async function runStartupSequence({etaHEN, optional, shortcut, log}) {
  await etaHEN();
  await optional();
  if (shortcut) {
    try { await shortcut(); }
    catch (error) {
      const warning = 'Payload sequence finished. Media shortcut was not confirmed: ' + (error.message || String(error));
      log(warning, 'error');
      return {warning};
    }
  }
  return {};
}
