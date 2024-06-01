import { io, Socket } from "npm:socket.io-client";
import { parseFlags } from "https://deno.land/x/cliffy@v1.0.0-rc.3/flags/mod.ts";
import { load as loadEnv } from "https://deno.land/std@0.223.0/dotenv/mod.ts";

import { ServerSentEvents } from "../server/types/Events.ts";
import { execute } from "./util/execute.ts";
import { play } from "./util/play.ts";

const env = await loadEnv();
const SOCKET_SERVER = env["SOCKET_SERVER"] ?? Deno.env.get("SOCKET_SERVER");
if (!SOCKET_SERVER) throw new Error("SOCKET_SERVER is not provided");

if (!await execute("which", ["aplay"])) {
  console.error(
    "ERROR: Install aplay first. apt-get install alsa-base alsa-utils",
  );
  Deno.exit(1);
}

const {
  flags: { token },
} = parseFlags(Deno.args);

if (typeof token !== "string") {
  console.error(
    "ERROR: Pass a token as an argument. e.g. --token=ABC45\n" +
      "       You can get a token by sending /token in the chat.",
  );
  Deno.exit(1);
}

const client: Socket<ServerSentEvents> = io(SOCKET_SERVER, {
  transports: ["websocket"],
  timeout: 5000,
  auth: { token },
});

let controller: AbortController | undefined;

client.on("prepare", (eventId, audioData, ack) => {
  controller?.abort();
  controller = new AbortController();

  const signal = controller.signal;

  const removeHandlers = () => {
    client.off("play", playHandler);
  };

  const playHandler: ServerSentEvents["play"] = async (playEventId, ack) => {
    if (playEventId !== eventId) return;

    removeHandlers();

    try {
      console.log("event %s received play", eventId);
      const success = await play(audioData, signal);
      console.log("event %s played. Success: %s", eventId, success);

      ack({ socketId: client.id!, success });
    } catch (error) {
      console.error(error);
      ack({ socketId: client.id!, success: false });
    }
  };
  client.on("play", playHandler);

  setTimeout(() => removeHandlers(), 15_000);

  console.log("event %s prepared", eventId);
  ack({ socketId: client.id! });
});

client.on("stop", (ack) => {
  if (controller) {
    controller.abort();
    controller = undefined;
  }

  console.log("stop");
  ack({ socketId: client.id!, success: true });
});

client.on("connect", () => {
  console.log("connection", client.id!);
});

client.on("disconnect", () => {
  console.log("disconnect");
});
