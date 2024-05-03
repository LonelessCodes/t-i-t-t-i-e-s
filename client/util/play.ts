export async function play(audioData: ArrayBuffer, signal: AbortSignal) {
  const byteData = new Uint8Array(audioData);

  const aplayProcess = new Deno.Command("aplay", {
    args: [
      "-r",
      "48000",
      "-t",
      "raw",
      "-f",
      "S16_LE",
      "-c1",
    ],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();

  signal.addEventListener("abort", () => {
    aplayProcess.kill();
  });

  try {
    const aplayWriter = aplayProcess.stdin.getWriter();
    await aplayWriter.write(byteData);
    await aplayWriter.close();

    const status = await aplayProcess.output();

    return status.success;
  } catch {
    return false;
  }
}
