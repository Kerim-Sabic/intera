import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from worker import validate_models, settings

class ModelBoundary(unittest.TestCase):
    def fixture(self, root):
        files = ['models/face_landmarker.task']
        for side in ('L', 'R'):
            prefix = f'weights/warping_model/flx/12/{side}/'
            files += [prefix + 'checkpoint', prefix + 'model.index', prefix + 'model.data-00000-of-00001']
        digests = {}
        for name in files:
            target = root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(b'synthetic-test-only')
            digests[name] = hashlib.sha256(target.read_bytes()).hexdigest()
        manifest = {'redistribution_review': 'approved', 'license_reference': 'synthetic fixture only', 'files': digests}
        (root / 'approved-models.json').write_text(json.dumps(manifest))
        return manifest

    def test_unreviewed_or_missing_model_never_passes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            with self.assertRaises(Exception): validate_models(root)
            manifest = self.fixture(root)
            validate_models(root)
            manifest['redistribution_review'] = 'pending'
            (root / 'approved-models.json').write_text(json.dumps(manifest))
            with self.assertRaises(ValueError): validate_models(root)

    def test_digest_and_traversal(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            manifest = self.fixture(root)
            (root / 'models/face_landmarker.task').write_bytes(b'tampered')
            with self.assertRaises(ValueError): validate_models(root)
            manifest = self.fixture(root)
            manifest['files']['../outside'] = '0' * 64
            (root / 'approved-models.json').write_text(json.dumps(manifest))
            with self.assertRaises(ValueError): validate_models(root)

    def test_settings_reject_accidental_audio_or_arbitrary_camera(self):
        value = {'camera': 0, 'enabled': True, 'offsetX': 0, 'offsetY': -21, 'offsetZ': -1, 'focalLength': 650}
        settings(value)
        with self.assertRaises(ValueError): settings({**value, 'camera': 'https://example.com'})
        with self.assertRaises(ValueError): settings({**value, 'offsetX': float('nan')})

if __name__ == '__main__': unittest.main()
