"""Executed on the authorized VPS; add an isolated builder preview service."""
import hashlib,json,pathlib,subprocess,sys,tarfile,urllib.request,time,os,shutil
archive=pathlib.Path(sys.argv[1]);expected=sys.argv[2];stamp=sys.argv[3]
assert len(expected)==64 and stamp.isdigit()
assert hashlib.sha256(archive.read_bytes()).hexdigest()==expected
base=pathlib.Path('/opt/snipers-youtube-builder');release=base/'releases'/stamp
release.mkdir(parents=True,exist_ok=False)
with tarfile.open(archive) as tar:tar.extractall(release,filter='data')
pins=json.loads((release/'relapse-host/artifacts/youtube-installer/runtime-pins.json').read_text())
def run(args):
 print('Running: '+args[0],flush=True)
 subprocess.run(args,check=True)
runtime=base/'runtimes';runtime.mkdir(exist_ok=True)
def download(url,digest,algorithm,file):
 if file.exists() and hashlib.new(algorithm,file.read_bytes()).hexdigest()==digest:return
 urllib.request.urlretrieve(url,str(file)+'.new')
 temp=pathlib.Path(str(file)+'.new')
 assert hashlib.new(algorithm,temp.read_bytes()).hexdigest()==digest
 temp.replace(file)
node=pins['node'];node_tar=runtime/node['file'];download(node['url'],node['sha256'],'sha256',node_tar)
node_root=runtime/node['file'].removesuffix('.tar.xz')
if not (node_root/'bin/node').exists():
 with tarfile.open(node_tar) as tar:tar.extractall(runtime,filter='data')
dotnet=pins['dotnet'];dotnet_root=runtime/'dotnet-10';dotnet_root.mkdir(exist_ok=True)
dotnet_tar=runtime/'dotnet-runtime.tar.gz';download(dotnet['url'],dotnet['hash'],'sha512',dotnet_tar)
if not (dotnet_root/'dotnet').exists():
 with tarfile.open(dotnet_tar) as tar:tar.extractall(dotnet_root,filter='data')
zig=pins['zig'];zig_tar=runtime/zig['file'];download(zig['url'],zig['sha256'],'sha256',zig_tar)
zig_root=runtime/zig['file'].removesuffix('.tar.xz')
if not (zig_root/'zig').exists():
 with tarfile.open(zig_tar) as tar:tar.extractall(runtime,filter='data')
if not shutil.which('git'):run(['apt-get','update']);run(['apt-get','install','-y','git'])
kernel=release/'relapse-y2jb/third_party/Relapse-Exploit'
run(['git','clone',str(release/'relapse-host/artifacts/youtube-installer/relapse-kernel.bundle'),str(kernel)])
run(['git','-C',str(kernel),'checkout','dd8e4e0914c5e9d066ee1f9b056be76cb992c8e0'])
run([str(node_root/'bin/node'),'--version']);run([str(dotnet_root/'dotnet'),'--list-runtimes'])
import pwd
try:pwd.getpwnam('snipers-builder')
except KeyError:run(['useradd','--system','--home','/var/lib/snipers-youtube-builder','--shell','/usr/sbin/nologin','snipers-builder'])
jobs=pathlib.Path('/var/lib/snipers-youtube-builder');jobs.mkdir(mode=0o700,exist_ok=True)
build=release/'relapse-y2jb/build';build.mkdir(exist_ok=True)
run(['chown','snipers-builder:snipers-builder',str(jobs),str(build)])
unit=f'''[Unit]
Description=Snipers YouTube bundle builder preview
After=network-online.target
[Service]
User=snipers-builder
Group=snipers-builder
WorkingDirectory={release}
ExecStart={node_root}/bin/node {release}/relapse-host/builder/server/start.mjs
Environment=PORT=8787
Environment=BUILDER_STORAGE={jobs}
Environment=BUILDER_ORIGIN=https://sniperscheats.lol
Environment=SNIPERS_BUILDS=1
Environment=SNIPERS_INSTALL_ENABLED=0
Environment=ZIG={zig_root}/zig
Environment=PS5_PAYLOAD_SDK={release}/ps-neighbourhood/tools/ps5-sdk-0.43/ps5-payload-sdk
Environment=DOTNET={dotnet_root}/dotnet
Environment=DOTNET_ROOT={dotnet_root}
Environment=DOTNET_ROLL_FORWARD=Major
Environment=DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1
Environment=SNIPERS_UFS_DLL={release}/relapse-y2jb/tools/ufs2/bin/Release/net9.0/ImageBuilder.dll
Restart=on-failure
RestartSec=3
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths={jobs} {build}
MemoryMax=900M
CPUQuota=150%
LimitNOFILE=512
[Install]
WantedBy=multi-user.target
'''
unit_path=pathlib.Path('/etc/systemd/system/snipers-youtube-builder.service')
if unit_path.exists():shutil.copy2(unit_path,str(unit_path)+'.before-'+stamp)
unit_path.write_text(unit);run(['systemctl','daemon-reload']);run(['systemctl','enable','--now','snipers-youtube-builder']);run(['systemctl','restart','snipers-youtube-builder'])
for i in range(20):
 try:
  assert json.load(urllib.request.urlopen('http://127.0.0.1:8787/api/health',timeout=2))['buildAvailable'];break
 except Exception:
  if i==19:raise
  time.sleep(.5)
config=pathlib.Path('/etc/nginx/sites-available/sniperscheats.lol');original=config.read_text();backup=pathlib.Path(str(config)+'.before-builder-'+stamp);backup.write_text(original)
locations=pathlib.Path('/etc/nginx/snipers-builder-locations.conf')
# Preserve the promoted homepage, recovery and package routes on later releases.
locations.write_text(locations.read_text() if locations.exists() else '''location = /builder { return 302 /builder/; }
location ^~ /builder/ {
    rewrite ^/builder/(.*)$ /$1 break;
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 64m;
    proxy_read_timeout 120s;
}
location ^~ /youtube-bundles/ {
    root /var/www/sniperscheats/current;
    gzip off;
    add_header Cache-Control "no-store" always;
    try_files $uri @snipers_youtube_bundle;
}
location @snipers_youtube_bundle {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header X-Real-IP $remote_addr;
}
''')
new=original
if 'include /etc/nginx/snipers-builder-locations.conf;' not in new:
 anchor='    root /var/www/sniperscheats/current;'
 assert anchor in new;new=new.replace(anchor,anchor+'\n    include /etc/nginx/snipers-builder-locations.conf;',1)
# Scoped HTTP images are integrity-pinned in the HTTPS-delivered installer ELF.
at=new.rfind('server {');head,tail=new[:at],new[at:]
if '@snipers_youtube_bundle' not in tail:
 assert 'location ^~ /youtube-bundles/' in tail
 tail=tail.replace('try_files $uri =404;','try_files $uri @snipers_youtube_bundle;',1)
 tail=tail.replace('    location / { return 301', '    location @snipers_youtube_bundle { proxy_pass http://127.0.0.1:8787; proxy_set_header X-Real-IP $remote_addr; }\n    location / { return 301',1)
config.write_text(head+tail)
try:run(['nginx','-t']);run(['systemctl','reload','nginx'])
except Exception:config.write_text(original);run(['nginx','-t']);run(['systemctl','reload','nginx']);raise
current=base/'current';temp=base/('current-'+stamp);temp.symlink_to(release);temp.replace(current)
live_catalog=json.load(urllib.request.urlopen('http://127.0.0.1:8787/api/catalog',timeout=5))
print(json.dumps({'release':str(release),'preview':'https://sniperscheats.lol/builder/','installEnabled':not live_catalog['verifyOnly'],'rootWebsiteReplaced':'location = / { return 302 /builder/; }' in locations.read_text()}),flush=True)
