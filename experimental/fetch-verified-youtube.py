"""Fetch the pinned older YouTube package using Sony's piece manifest.

Format follows John Tornblom's GPL-3.0-or-later prospero-fetchpkg (SDK 0.43).
Unlike its warning-only checks, every offset, length and hash mismatch is fatal.
Sony's SGST chain is not in the PC/VPS root stores. The SDK also handles this
with a request-local TLS exception. This does not change system trust settings
and is not a claim of TLS authentication or Sony signature verification.
"""
import hashlib, importlib.util, json, pathlib, ssl, urllib.parse, urllib.request
ROOT = pathlib.Path(__file__).resolve().parent
MANIFEST = 'https://sgst.prod.dl.playstation.net/sgst/prod/00/PPSA01650_00/app/info/7/f_cfbc3abdcd214584551586f604b4d8538750889cd41704788e5f24bbc6685327/UP4381-PPSA01650_00-YOUTUBESIEA00000.json'
def request(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.hostname not in {'sgst.prod.dl.playstation.net', 'gst.prod.dl.playstation.net'} or parsed.username or parsed.password:
        raise ValueError('Unrecognized package origin')
    if parsed.scheme not in {'http', 'https'}: raise ValueError('Invalid transport')
    context = ssl.create_default_context()
    if parsed.hostname == 'sgst.prod.dl.playstation.net':
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'}), context=context, timeout=45)
with request(MANIFEST) as response:
    raw = response.read(1024*1024+1)
if len(raw)>1024*1024: raise ValueError('Manifest exceeds bound')
manifest = json.loads(raw)
size = manifest['originalFileSize']
if not isinstance(size, int) or not 1024 < size < 256*1024*1024: raise ValueError('Invalid package size')
destination = ROOT/'local/packages/YouTube-PPSA01650-01.000.003.pkg'
destination.parent.mkdir(parents=True, exist_ok=True)
temporary = destination.with_suffix('.pkg.partial')
records = []
with temporary.open('wb') as output:
    for piece in sorted(manifest['pieces'], key=lambda p:p['fileOffset']):
        if output.tell()!=piece['fileOffset']: raise ValueError('Non-contiguous piece offsets')
        expected_size = piece['fileSize']
        if not isinstance(expected_size,int) or expected_size<1 or output.tell()+expected_size>size: raise ValueError('Invalid piece size')
        sha1, sha256 = hashlib.sha1(),hashlib.sha256()
        downloaded=0
        with request(piece['url']) as response:
            while True:
                data=response.read(1024*1024)
                if not data: break
                downloaded+=len(data)
                if downloaded>expected_size: raise ValueError('Oversized piece')
                sha1.update(data);sha256.update(data);output.write(data)
        if downloaded!=expected_size or piece['hashValue'].lower() not in (sha1.hexdigest(),sha256.hexdigest()): raise ValueError('Piece integrity mismatch')
        records.append({'offset':piece['fileOffset'],'bytes':downloaded,'sha256':sha256.hexdigest(),'manifestHash':piece['hashValue']})
    if output.tell()!=size: raise ValueError('Package size mismatch')
data=temporary.read_bytes()
spec=importlib.util.spec_from_file_location('package_verifier',ROOT/'verify-youtube-package.py')
verifier=importlib.util.module_from_spec(spec);spec.loader.exec_module(verifier)
verification=verifier.verify(data,manifest)
record={'version':'01.000.003','titleId':'PPSA01650','bytes':size,'sha256':hashlib.sha256(data).hexdigest(),'manifestUrl':MANIFEST,'manifestSha256':hashlib.sha256(raw).hexdigest(),'tlsCertificateVerified':False,'pieceChecksumsVerified':True,'consoleInstallVerified':False,'pieces':records}
record.update(verification)
temporary.replace(destination)
(ROOT/'youtube-003.json').write_text(json.dumps(record,indent=2)+'\n')
(ROOT/'local/packages/youtube-003-manifest.json').write_bytes(raw)
print(json.dumps(record))
