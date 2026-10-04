// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
export const CHANNEL='experimental', BASE_PATH='/builder/ex';
export const profiles=JSON.parse(fs.readFileSync(new URL('./firmware-profiles.json',import.meta.url)));
export function firmwareProfile(firmware){
 if(typeof firmware!=='string')throw Error('Choose your exact PS5 firmware.');
 const profile=profiles.firmwares.find(p=>p.firmware===firmware);
 if(!profile)throw Error(profiles.excluded[firmware]||'This firmware has no experimental profile.');
 return profile;
}
// Promotion is explicit and per firmware. Table coverage alone never enables installation.
export function readRelease(file=new URL('./release-manifest.json',import.meta.url)){
 const release=JSON.parse(fs.readFileSync(file));
 if(release.channel!==CHANNEL||release.basePath!==BASE_PATH)throw Error('Wrong release channel');
 for(const item of release.candidates){firmwareProfile(item.firmware);if(!['building','local-checks-passed','community-tested'].includes(item.status))throw Error('Invalid candidate state');}
 return release;
}
export function candidateReady(firmware,release=readRelease()){
 firmwareProfile(firmware);const item=release.candidates.find(c=>c.firmware===firmware);
 return !!item&&['local-checks-passed','community-tested'].includes(item.status)&&item.installerReady===true&&item.startupReady===true;
}
