FROM denoland/deno:latest

RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app

COPY . ./

RUN deno cache main.ts

VOLUME [ "/data" ]
EXPOSE 4000

CMD ["run", "-A", "--unstable-kv", "main.ts"]
