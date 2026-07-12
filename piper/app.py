"""Minimal PiperTTS HTTP server matching the contract IntelliSTAR's
PiperTTSInterface.js / PiperTTSClient.js already expect:
  GET  /voices  -> JSON object keyed by voice name
  POST /        -> JSON body {"text": ..., "voice": ...} -> audio/wav bytes

Neither the stock `piper.http_server` module nor other community Piper HTTP
servers expose this exact shape, so this is a small purpose-built wrapper
around the `piper-tts` Python library instead.
"""

import io
import os
import wave
from pathlib import Path

import onnxruntime
from flask import Flask, Response, jsonify, request
from piper import PiperVoice

# Docker running inside an LXC container (or other nested/cgroup-restricted setups)
# can report a CPU count to onnxruntime that doesn't match the CPU affinity mask the
# container is actually allowed to set. onnxruntime's default thread pool size (0 =
# "auto-detect") tries to pin one OS thread per detected CPU via pthread_setaffinity_np,
# which then fails with EINVAL for every thread ("Specify the number of threads
# explicitly so the affinity is not set" -- onnxruntime's own error message names the
# fix). PiperVoice.load() doesn't expose a way to pass custom SessionOptions, so this
# patches onnxruntime.SessionOptions itself -- applied before any voice is loaded
# below, so it's in effect for every session PiperVoice.load() constructs internally.
_PIPER_NUM_THREADS = int(os.environ.get("PIPER_NUM_THREADS", "2"))
_original_session_options_init = onnxruntime.SessionOptions.__init__


def _patched_session_options_init(self, *args, **kwargs):
    _original_session_options_init(self, *args, **kwargs)
    self.intra_op_num_threads = _PIPER_NUM_THREADS
    self.inter_op_num_threads = 1


onnxruntime.SessionOptions.__init__ = _patched_session_options_init

VOICES_DIR = Path(os.environ.get("PIPER_VOICES_DIR", "/voices"))

app = Flask(__name__)

# Load every .onnx voice model found in VOICES_DIR at startup, keyed by filename
# (without extension) -- e.g. "en_US-lessac-medium". Add more *.onnx/*.onnx.json
# pairs to the voices/ build directory (see Dockerfile) to serve multiple voices.
voices = {}
for onnx_path in sorted(VOICES_DIR.glob("*.onnx")):
    voice_name = onnx_path.stem
    print(f"Loading voice: {voice_name}")
    voices[voice_name] = PiperVoice.load(str(onnx_path))

if not voices:
    raise RuntimeError(f"No .onnx voice models found in {VOICES_DIR}")

default_voice_name = next(iter(voices))


@app.get("/voices")
def list_voices():
    return jsonify({name: {} for name in voices})


@app.post("/")
def synthesize():
    data = request.get_json(force=True)
    text = data.get("text", "")
    voice = voices.get(data.get("voice"), voices[default_voice_name])

    wav_io = io.BytesIO()
    with wave.open(wav_io, "wb") as wav_file:
        voice.synthesize_wav(text, wav_file)

    return Response(wav_io.getvalue(), mimetype="audio/wav")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, threaded=True)
