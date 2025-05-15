FROM denoland/deno:alpine-2.3.1

RUN apk add --no-cache alsa-utils alsaconf ffmpeg && \
    addgroup deno audio && \
    adduser  root audio

WORKDIR /app

# Prefer not to run as root.
USER deno

# Cache the dependencies as a layer (the following two steps are re-run only when main.ts is modified).
COPY deno.* .
RUN deno install

# These steps will be re-run upon each file change in your working directory:
COPY . .
# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache main.ts

VOLUME [ "/app/data" ]

CMD ["deno", "run", "--allow-read", "--allow-write" "--allow-env", "--allow-net", "--allow-run=aplay", "--unstable-kv", "main.ts"]
