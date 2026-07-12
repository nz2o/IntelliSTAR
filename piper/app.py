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

from flask import Flask, Response, jsonify, request
from piper import PiperVoice

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
