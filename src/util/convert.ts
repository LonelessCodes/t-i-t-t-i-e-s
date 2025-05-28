export async function convert(url: string) {
  const request = await fetch(url);

  const ffmpeg = new Deno.Command("ffmpeg", {
    args: [
      "-i",
      "pipe:0",
      "-f",
      "s16le",
      "-acodec",
      "pcm_s16le",
      "-ar",
      "48000",
      "-ac",
      "1",
      "-af",
      "speechnorm=e=12.5:r=0.0001:l=1",
      "pipe:1",
    ],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();

  request.body?.pipeTo(ffmpeg.stdin);

  const { stdout, stderr, success } = await ffmpeg.output();
  if (!success) {
    console.error(new TextDecoder("utf-8").decode(stderr));
    throw new Error("ffmpeg failed");
  }

  return stdout;
}
