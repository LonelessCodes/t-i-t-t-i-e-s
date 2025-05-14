import { play } from "./util/play.ts";

export class CombinedPlayer {
  private controller: AbortController | null = null;

  async play(eventId: number, audioData: ArrayBufferLike): Promise<boolean> {
    this.controller?.abort();
    this.controller = new AbortController();

    const signal = this.controller.signal;

    console.log("event %d playing", eventId);
    const success = await play(audioData, signal);
    console.log("event %d played. Success: %s", eventId, success);

    if (!success && !this.controller) {
      return false;
    }
    if (!success) {
      throw new Error("wtf no success");
    }

    return true;
  }

  stop(): void {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }

    console.log("stop");
  }
}
