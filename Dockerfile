FROM denoland/deno:debian-2.2.13

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        alsa-utils ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    usermod -a -G audio deno && \
    usermod -a -G audio root

WORKDIR /app

# Prefer not to run as root.
USER deno

# Cache the dependencies as a layer (the following two steps are re-run only when main.ts is modified).
COPY deno.* .
RUN deno install

# These steps will be re-run upon each file change in your working directory:
COPY . .
# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache ./src/main.ts

VOLUME [ "/app/data" ]

CMD ["run", "--allow-read", "--allow-write" "--allow-env", "--allow-net", "--allow-run=aplay,ffmpeg", "--unstable-kv", "./src/main.ts"]
