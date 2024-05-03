export interface ServerSentEvents {
  prepare: (
    eventId: string,
    // url: string[],
    data: ArrayBuffer,
    ack: (_: { socketId: string }) => void,
  ) => void;
  play: (
    eventId: string,
    ack: (_: { socketId: string; success: boolean }) => void,
  ) => void;
  stop: (
    ack: (_: { socketId: string; success: boolean }) => void,
  ) => void;
}
// deno-lint-ignore ban-types
export type ServerListenEvents = {};
