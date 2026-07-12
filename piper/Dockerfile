FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir piper-tts flask

# Bake in the default voice referenced by scripts/startpiper.sh so the image is
# fully self-contained after building -- no internet access needed at runtime.
RUN mkdir -p /voices && \
    python -c "\
import urllib.request; \
base = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx'; \
urllib.request.urlretrieve(base, '/voices/en_US-lessac-medium.onnx'); \
urllib.request.urlretrieve(base + '.json', '/voices/en_US-lessac-medium.onnx.json')"

COPY app.py .

EXPOSE 5000

HEALTHCHECK --interval=5s --timeout=3s --start-period=20s --retries=6 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/voices', timeout=2)" || exit 1

CMD ["python", "app.py"]
