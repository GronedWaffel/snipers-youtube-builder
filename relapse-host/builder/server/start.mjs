import {fileURLToPath} from 'node:url';
import {createBuilderServer} from './app.mjs';import {createImageWorker} from './worker.mjs';
const port=Number(process.env.PORT||8791),enabled=process.env.SNIPERS_BUILDS==='1';
const worker=enabled?createImageWorker({address:process.env.BUNDLE_ADDRESS||'64.20.57.42',host:process.env.BUNDLE_HOST||'sniperscheats.lol',verifyOnly:process.env.SNIPERS_INSTALL_ENABLED!=='1'}):null;
const maxJobs=Number(process.env.SNIPERS_MAX_JOBS||100);
const maxConcurrentBuilds=Number(process.env.SNIPERS_BUILD_WORKERS||2);
const server=await createBuilderServer({storage:process.env.BUILDER_STORAGE||fileURLToPath(new URL('../../artifacts/unified-jobs/',import.meta.url)),origin:process.env.BUILDER_ORIGIN||'https://sniperscheats.lol',verifyOnly:process.env.SNIPERS_INSTALL_ENABLED!=='1',maxJobs,maxConcurrentBuilds,worker});
server.listen(port,'127.0.0.1',()=>console.log('YouTube builder listening on '+port+'; builds='+enabled+'; install='+process.env.SNIPERS_INSTALL_ENABLED));
