"""Intera development worker. Local stdin/stdout only; no server or frame files."""
import base64
import contextlib
import hashlib
import json
import math
import os
import re
from pathlib import Path
import signal
import sys

ROOT = Path(sys.executable).resolve().parent if getattr(sys, 'frozen', False) else Path(__file__).resolve().parent
DATA = Path(os.environ.get('INTERA_CAMERA_DATA', ROOT / 'development-data'))
OUT = sys.stdout

def emit(event):
    OUT.write(json.dumps(event, separators=(',', ':')) + '\n')
    OUT.flush()

def validate_models(root):
    # Approval belongs to a release reviewer; it is never silently generated.
    manifest = json.loads((root / 'approved-models.json').read_text())
    if manifest.get('redistribution_review') != 'approved' or not manifest.get('license_reference'):
        raise ValueError('Model licensing unreviewed')
    files = manifest['files']
    if 'models/face_landmarker.task' not in files:
        raise ValueError('Missing MediaPipe landmarks')
    for side in ('L', 'R'):
        prefix = f'weights/warping_model/flx/12/{side}/'
        if not any(p.startswith(prefix) and p.endswith('.index') for p in files):
            raise ValueError('Missing checkpoint')
        if not any(p.startswith(prefix) and '.data-' in p for p in files):
            raise ValueError('Missing checkpoint data')
        if prefix + 'checkpoint' not in files:
            raise ValueError('Missing checkpoint metadata')
        metadata = (root / (prefix + 'checkpoint')).read_text()
        match = re.search(r'^model_checkpoint_path:\s*"([A-Za-z0-9_-]+)"\s*$', metadata, re.MULTILINE)
        if not match or prefix + match[1] + '.index' not in files or not any(p.startswith(prefix + match[1] + '.data-') for p in files):
            raise ValueError('Checkpoint refers to unreviewed files')
    for folder in ('weights', 'models'):
        for target in (root / folder).rglob('*'):
            if target.is_file() and target.name != 'README.txt' and target.relative_to(root).as_posix() not in files:
                raise ValueError('Unreviewed model asset in bundle')
    for name, expected in files.items():
        target = (root / name).resolve()
        if not target.is_relative_to(root.resolve()) or not isinstance(expected, str) or len(expected) != 64:
            raise ValueError('Invalid model path or digest')
        if hashlib.sha256(target.read_bytes()).hexdigest() != expected:
            raise ValueError('Model digest mismatch')

def settings(raw):
    ranges = {'camera': (0, 8), 'offsetX': (-30, 30), 'offsetY': (-40, 40), 'offsetZ': (-20, 20), 'focalLength': (300, 1500)}
    for key, (low, high) in ranges.items():
        value = raw[key]
        if type(value) not in (int, float) or not low <= value <= high:
            raise ValueError('Invalid setting')
    if type(raw['camera']) is not int or type(raw['enabled']) is not bool:
        raise ValueError('Invalid camera setting')
    return raw

def physical_camera_index(device_ids, requested):
    # Match OpenCV 4.11's AVFoundation unique-ID ordering, exclude our sink.
    ordered = sorted(device_ids)
    eligible = [index for index, uid in enumerate(ordered)
                if uid.lower() != 'd843482c-c61b-44a2-a317-e2869f0c5d91']
    if requested >= len(eligible):
        raise ValueError('No selected physical camera')
    return eligible[requested]

def correctable_geometry(face, width, height, border=(3, 4)):
    """Skip missing, clipped or tiny eye crops instead of killing the video stream."""
    try:
        eyes = (face.left_eye, face.right_eye)
        for eye in eyes:
            if eye is None:
                return False
            row, col = eye.top_left
            rows, cols = eye.original_size
            if any(type(value) is not int for value in (row, col, rows, cols)):
                return False
            if row < 0 or col < 0 or row + rows > height or col + cols > width:
                return False
            if rows <= 2 * border[0] or cols <= 2 * border[1]:
                return False
            if len(eye.center) != 2 or not all(math.isfinite(value) for value in eye.center):
                return False
        return math.dist(eyes[0].center, eyes[1].center) > 1
    except (AttributeError, TypeError, ValueError, OverflowError):
        return False

def main():
    cap = corrector = None
    try:
        initial = settings(json.loads(sys.stdin.readline()))
        try:
            validate_models(ROOT / 'upstream')
        except Exception:
            emit({'type': 'error', 'code': 'models'})
            return
        # Upstream progress output cannot contaminate the framed protocol.
        with contextlib.redirect_stdout(sys.stderr):
            sys.path.insert(0, str(ROOT / 'upstream'))
            import cv2
            from AVFoundation import AVCaptureDevice, AVMediaTypeVideo, AVMediaTypeMuxed
            from displayers.face_predictor import create_face_predictor, EyeExtractionConfig
            from model_managers.gaze_corrector_v1 import GazeCorrector
            os.chdir(ROOT / 'upstream')
            DATA.mkdir(parents=True, exist_ok=True)
            corrector = GazeCorrector(db_path=str(DATA / 'calibration.db'))
            predictor = create_face_predictor('mediapipe')
            eye_config = EyeExtractionConfig()
            if cv2.__version__ != '4.11.0':
                raise ValueError('Camera enumeration requires the pinned OpenCV backend')
            devices = list(AVCaptureDevice.devicesWithMediaType_(AVMediaTypeVideo)) + list(AVCaptureDevice.devicesWithMediaType_(AVMediaTypeMuxed))
            try:
                camera_index = physical_camera_index([str(device.uniqueID()) for device in devices], initial['camera'])
            except ValueError:
                emit({'type': 'error', 'code': 'camera'})
                return
            cap = cv2.VideoCapture(camera_index, cv2.CAP_AVFOUNDATION)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            if not cap.isOpened():
                emit({'type': 'error', 'code': 'camera'})
                return
            signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
            emit({'type': 'ready'})
            current = initial
            for line in sys.stdin:
                if len(line) > 4096:
                    raise ValueError('Oversized command')
                command = json.loads(line)
                if command['type'] == 'stop':
                    break
                if command['type'] == 'configure':
                    updated = settings(command)
                    if updated['camera'] != initial['camera']:
                        raise ValueError('Stop before changing camera')
                    current = updated
                    corrector.set_camera_offset(current['offsetX'], current['offsetY'], current['offsetZ'])
                    corrector.set_focal_length(current['focalLength'])
                elif command['type'] == 'frame':
                    ok, frame = cap.read()
                    if not ok:
                        emit({'type': 'error', 'code': 'camera'})
                        break
                    frame = cv2.resize(frame, (640, 480))
                    if current['enabled']:
                        faces = predictor.list_eye_data(frame, eye_config)
                        if faces and correctable_geometry(faces[0], 640, 480, corrector.pixel_cut):
                            original = frame.copy()
                            try:
                                frame = corrector.apply_correction(frame, faces[0], (640, 480))
                            except (ZeroDivisionError, FloatingPointError):
                                # Degenerate calibration/landmarks: show the original frame.
                                # Model/runtime failures still terminate through the outer handler.
                                frame = original
                    ok, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
                    if not ok:
                        raise ValueError('Encoding failed')
                    emit({'type': 'frame', 'jpeg': base64.b64encode(jpeg).decode('ascii')})
                else:
                    raise ValueError('Invalid command')
    except Exception:
        emit({'type': 'error', 'code': 'engine'})
    finally:
        with contextlib.redirect_stdout(sys.stderr):
            if cap is not None:
                cap.release()
            if corrector is not None:
                corrector.close()

if __name__ == '__main__':
    main()
