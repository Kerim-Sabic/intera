import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
from worker import validate_models, settings, physical_camera_index, correctable_geometry

class ModelBoundary(unittest.TestCase):
    def test_invalid_eye_geometry_does_not_enter_correction(self):
        left = SimpleNamespace(top_left=(100, 100), original_size=(24, 32), center=(116, 112))
        right = SimpleNamespace(top_left=(100, 200), original_size=(24, 32), center=(216, 112))
        face = SimpleNamespace(left_eye=left, right_eye=right)
        self.assertTrue(correctable_geometry(face, 640, 480))
        for changes in ({'top_left': (-5, 100)}, {'top_left': (470, 100)}, {'original_size': (6, 32)}, {'original_size': (24, 8)}, {'center': (float('nan'), 112)}, {'center': right.center}):
            invalid = SimpleNamespace(**{**vars(left), **changes})
            self.assertFalse(correctable_geometry(SimpleNamespace(left_eye=invalid, right_eye=right), 640, 480))
        self.assertFalse(correctable_geometry(SimpleNamespace(left_eye=None, right_eye=right), 640, 480))
    def test_virtual_camera_cannot_recursively_capture_itself(self):
        uid = 'D843482C-C61B-44A2-A317-E2869F0C5D91'
        self.assertEqual(physical_camera_index(['Z-physical', uid], 0), 1)
        with self.assertRaises(ValueError): physical_camera_index([uid], 0)
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
            if target.name == 'checkpoint': target.write_text('model_checkpoint_path: "model"\n')
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

    def test_checkpoint_cannot_reference_unreviewed_external_weights(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            manifest = self.fixture(root)
            target = root / 'weights/warping_model/flx/12/L/checkpoint'
            target.write_text('model_checkpoint_path: "/other/weights"\n')
            manifest['files'][target.relative_to(root).as_posix()] = hashlib.sha256(target.read_bytes()).hexdigest()
            (root / 'approved-models.json').write_text(json.dumps(manifest))
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
