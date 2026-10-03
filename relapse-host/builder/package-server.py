"""Create a minimal private VPS deployment archive, excluding console data/secrets."""
import pathlib,tarfile,json,hashlib
workspace=pathlib.Path(__file__).resolve().parents[2]
art=workspace/'relapse-host/artifacts/youtube-installer'
files=set()
for folder in ['relapse-host/builder','relapse-y2jb/src','relapse-y2jb/third_party/y2jb-host']:
 for f in (workspace/folder).rglob('*'):
  if f.is_file() and '.git' not in f.parts and '__pycache__' not in f.parts:files.add(f.relative_to(workspace).as_posix())
files.update(json.loads((art/'hosted-files.json').read_text()))
files.update(['relapse-host/site/src/autoload.js','relapse-host/site/src/sha256.js','relapse-host/site/src/optional-manifest.js','relapse-y2jb/tools/build.mjs','relapse-y2jb/tools/build-snipers.mjs','relapse-y2jb/SNIPERS-SETUP.md','relapse-y2jb/SNIPERS-CREDITS.md','relapse-y2jb/LICENSE'])
for name in ['ImageBuilder.dll','ImageBuilder.deps.json','ImageBuilder.runtimeconfig.json']:
 files.add('relapse-y2jb/tools/ufs2/bin/Release/net9.0/'+name)
for name in ['Snipers-YouTube-Installer.template.elf','Snipers-EtaHEN-Ready.elf','readiness-manifest.json','relapse-kernel.bundle','runtime-pins.json']:
 files.add('relapse-host/artifacts/youtube-installer/'+name)
# Only two small assets have page-relative URLs in the existing browser runtime.
for name in ['src/utils/rop_slave.js','offsets/13.60.js']:
 files.add('relapse-host/site/online/2ea9344fcd6fbcb7/'+name)
# Cross-compile the native startup on the VPS; no uploaded ELF is executed.
sdk='ps-neighbourhood/tools/ps5-sdk-0.43/ps5-payload-sdk/'
for f in (workspace/(sdk+'target/include')).rglob('*'):
 if f.is_file() and 'c++' not in f.parts:files.add(f.relative_to(workspace).as_posix())
for name in ['crt1.o','libc.a','libdl.a','libkernel_web.so','libSceLibcInternal.so','libSceSystemService.so']:
 files.add(sdk+'target/lib/'+name)
files.add(sdk+'ldscripts/elf_x86_64.x')
for name in ['notify.c','sha256.c','sha256.h','LICENSE']:
 files.add('relapse-host/vendor/ftpsrv-0.21.1/'+name)
dest=art/'builder-server.tar.gz'
with tarfile.open(dest,'w:gz',compresslevel=6) as tar:
 for name in sorted(files):
  file=(workspace/name).resolve();assert file.is_relative_to(workspace)
  tar.add(file,arcname=name,recursive=False)
digest=hashlib.sha256(dest.read_bytes()).hexdigest()
(art/'builder-server.sha256').write_text(digest)
print(json.dumps({'archive':str(dest),'files':len(files),'bytes':dest.stat().st_size,'sha256':digest}))
