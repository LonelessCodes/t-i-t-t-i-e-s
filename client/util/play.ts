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

  const abortHandler = () => {
    try {
      aplayProcess.kill();
    } catch (error) {
      console.error("could kill process", error);
    }
  };
  signal.addEventListener("abort", abortHandler);

  try {
    const aplayWriter = aplayProcess.stdin.getWriter();
    await aplayWriter.write(byteData);
    await aplayWriter.close();

    const status = await aplayProcess.output();

    signal.removeEventListener("abort", abortHandler);

    return status.success;
  } catch {
    return false;
  }
}
