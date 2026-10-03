"""Package source and notices only; exclude build products and console state."""
import pathlib,zipfile,hashlib,argparse,subprocess,shutil
root=pathlib.Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--out',type=pathlib.Path)
parser.add_argument('--directory',type=pathlib.Path)
args=parser.parse_args()
folders=['relapse-host/builder','relapse-host/optional','relapse-host/vendor/ShadowMountPlus-1.7beta2','relapse-host/vendor/ftpsrv-0.21.1','relapse-y2jb/src','relapse-y2jb/third_party/y2jb-host','relapse-y2jb/tools']
skip={'.git','node_modules','build','bin','obj','zig-cache','__pycache__','.codex'}
extensions={'.c','.h','.cpp','.hpp','.s','.S','.js','.mjs','.py','.cs','.csproj','.md','.txt','.json','.html','.css','.sh','.ps1','.bat','.yml','.yaml','.ini','.example','.xml','.config','.Config','.cmake','.png','.svg'}
files=set()
for folder in folders:
 for p in (root/folder).rglob('*'):
  if p.is_file() and not skip.intersection(p.relative_to(root).parts) and (p.suffix in extensions or p.name in ['LICENSE','Makefile','COPYING','.gitignore']):files.add(p)
for name in ['relapse-y2jb/SNIPERS-SETUP.md','relapse-y2jb/SNIPERS-CREDITS.md','relapse-y2jb/LICENSE','relapse-host/site/src/autoload.js','relapse-host/site/src/sha256.js','relapse-host/site/src/optional-manifest.js','relapse-host/scripts/build-shadowmount-compat.mjs','relapse-host/scripts/build-optional.mjs','relapse-host/shortcut/syscall-shim.S','relapse-host/artifacts/youtube-installer/relapse-kernel.bundle']:
 files.add(root/name)
for name in ['README.md','BUILD.md','NOTES.md']:
 files.add(root/'relapse-y2jb'/name)
for folder in ['relapse-host/site/online/2ea9344fcd6fbcb7','relapse-host/site/src','relapse-host/site/offsets']:
 for p in (root/folder).rglob('*'):
  if p.is_file() and p.suffix in extensions:files.add(p)
files.add(root/'relapse-host/site/LICENSE')
for name in ['loader.js','catalog.json']:files.add(root/'relapse-host/site/payloads'/name)
# Tracked etaHEN sources plus the diagnostic additions used in the ten-run test.
# Exclude compiled inputs, console captures and unrelated local experiments.
tracked=subprocess.check_output(['git','-C',str(root/'etahen-13.60'),'ls-files','-z']).decode().split('\0')
for name in tracked:
 p=root/'etahen-13.60'/name
 if name and p.is_file() and (p.suffix in extensions or p.name in ['LICENSE','Makefile','COPYING','.gitignore','.clang-tidy']):files.add(p)
for name in ['Source Code/include/port_diagnostic.h','Source Code/include/port_timing.h','Source Code/libNineS/src/port_diagnostic.c','Source Code/shellui/include/port_trace.hpp','scripts/build-toolbox-diagnostic.mjs','scripts/build-shellui-trace.mjs','scripts/build-startup-profile.mjs','tests/publication-mocks.h','tests/publication.c','tests/publication.test.mjs']:
 files.add(root/'etahen-13.60'/name)
out=(args.out or root/'relapse-host/builder/web/sources.zip').resolve()
out.parent.mkdir(parents=True,exist_ok=True)
if args.directory:
 if args.directory.exists():raise ValueError('Export directory must be new')
 args.directory.mkdir(parents=True)
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(files):
  name=p.relative_to(root).as_posix()
  z.write(p,name)
  if args.directory:
   dest=args.directory/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
print(f'{len(files)} source files; {out.stat().st_size} bytes; SHA256 {hashlib.sha256(out.read_bytes()).hexdigest()}')
