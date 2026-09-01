import json
import sys

from nudenet import NudeDetector


def main():
    image_bytes = sys.stdin.buffer.read()
    if not image_bytes:
        raise ValueError("No image data received")
    detector = NudeDetector()
    detections = detector.detect(image_bytes)
    sys.stdout.write(json.dumps(detections, separators=(",", ":")))


if __name__ == "__main__":
    main()
