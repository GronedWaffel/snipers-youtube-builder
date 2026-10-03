import {createBuilderServer} from './app.mjs';import {createImageWorker} from './worker.mjs';
const port=Number(process.env.PORT||8787),enabled=process.env.SNIPERS_BUILDS==='1';
const worker=enabled?createImageWorker({address:process.env.BUNDLE_ADDRESS||'74.50.81.85',host:process.env.BUNDLE_HOST||'sniperscheats.lol',verifyOnly:process.env.SNIPERS_INSTALL_ENABLED!=='1'}):null;
const server=await createBuilderServer({storage:process.env.BUILDER_STORAGE,origin:process.env.BUILDER_ORIGIN||'https://sniperscheats.lol',verifyOnly:process.env.SNIPERS_INSTALL_ENABLED!=='1',worker});
server.listen(port,'127.0.0.1',()=>console.log('YouTube builder listening on '+port+'; builds='+enabled+'; install='+process.env.SNIPERS_INSTALL_ENABLED));
