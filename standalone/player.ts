import { play } from "../util/play.ts";

let controller: AbortController | undefined;

export async function playCombined(
  eventId: number,
  audioData: ArrayBufferLike,
) {
  controller?.abort();
  controller = new AbortController();

  const signal = controller.signal;

  console.log("event %d playing", eventId);
  const success = await play(audioData, signal);
  console.log("event %d played. Success: %s", eventId, success);

  if (!success && !controller) {
    return false;
  }
  if (!success) {
    throw new Error("wtf no success");
  }

  return true;
}

export function stopCombined() {
  if (controller) {
    controller.abort();
    controller = undefined;
  }

  console.log("stop");
}
