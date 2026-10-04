import fs from 'node:fs/promises';
const headers={'User-Agent':'Snipers-firmware-research','Accept':'application/vnd.github+json'};
async function json(url){const r=await fetch(url,{headers});if(!r.ok)throw Error(url+' '+r.status);return r.json();}
const forks=await json('https://api.github.com/repos/ntfargo/Relapse-Exploit/forks?sort=newest&per_page=100');
const repos=[{full_name:'ntfargo/Relapse-Exploit',default_branch:'main'},{full_name:'soniciso1/relapse',default_branch:'main'},{full_name:'soniciso1/relapse-dev',default_branch:'main'},...forks];
let cursor=0;const results=[];
await Promise.all(Array.from({length:5},async()=>{while(cursor<repos.length){const repo=repos[cursor++];const files=[];for(const fw of ['9.05','11.40']){const url=`https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/offsets/${fw}.js`;const r=await fetch(url,{signal:AbortSignal.timeout(15000)});const text=await r.text();files.push({firmware:fw,status:r.status,url,...(r.ok?{bytes:text.length,hasKernelAllproc:/OFFSET_KERNEL_ALLPROC/.test(text)}:{})});}results.push({repository:repo.full_name,files});}}));
await fs.writeFile(new URL('./upstream/missing-table-search.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),scope:'Main projects and 100 newest public ntfargo forks; exact offsets filenames only',results},null,2));
console.log(JSON.stringify({repositories:results.length,found:results.flatMap(r=>r.files.filter(f=>f.status===200).map(f=>({repository:r.repository,...f}))),unexpected:results.flatMap(r=>r.files.filter(f=>![200,404].includes(f.status)).map(f=>({repository:r.repository,...f})))}));
