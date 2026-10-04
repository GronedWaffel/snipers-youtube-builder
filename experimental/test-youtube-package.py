"""Offline regression checks against the downloaded package fixture."""
import copy
import hashlib
import importlib.util
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('package_verifier', ROOT / 'verify-youtube-package.py')
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)

class PackageVerification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = (ROOT / 'local/packages/YouTube-PPSA01650-01.000.003.pkg').read_bytes()
        cls.manifest = json.loads((ROOT / 'local/packages/youtube-003-manifest.json').read_text())

    def test_active_metadata_not_historical_versions(self):
        result = verifier.verify(self.data, self.manifest)
        self.assertEqual(result['metadata']['contentVersion'], '01.000.003')
        self.assertEqual(result['metadata']['requiredSystemSoftwareVersion'], '0x0403000000000000')

    def test_corrupt_download_rejected(self):
        changed = bytearray(self.data)
        changed[1024] ^= 1
        with self.assertRaisesRegex(ValueError, 'checksum'):
            verifier.verify(changed, self.manifest)

    def test_truncated_download_rejected(self):
        with self.assertRaisesRegex(ValueError, 'length'):
            verifier.verify(self.data[:-1], self.manifest)

    def test_wrong_app_rejected_even_with_matching_piece_hashes(self):
        changed = bytearray(self.data)
        start = 81869920  # Recorded active param.json entry, not origin-param.
        title = changed.index(b'"PPSA01650"', start)
        changed[title:title+11] = b'"PPSA99999"'
        manifest = copy.deepcopy(self.manifest)
        for piece in manifest['pieces']:
            offset, size = piece['fileOffset'], piece['fileSize']
            piece['hashValue'] = hashlib.sha256(changed[offset:offset+size]).hexdigest()
        with self.assertRaisesRegex(ValueError, 'Unexpected app identity'):
            verifier.verify(changed, manifest)

if __name__ == '__main__':
    unittest.main()
