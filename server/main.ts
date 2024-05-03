import { Server } from "npm:socket.io";
import { Telegraf } from "npm:telegraf";
import { message } from "npm:telegraf/filters";
import { Audio, Message, Voice } from "npm:@telegraf/types";
import { load as loadEnv } from "https://deno.land/std@0.223.0/dotenv/mod.ts";

import { ServerListenEvents, ServerSentEvents } from "./types/Events.ts";
import { generateToken, getToken } from "./entities/token.ts";
import { delJingle, getJingle, setJingle } from "./entities/jingle.ts";
import { convert } from "./util/convert.ts";
import { concatUint8Arrays } from "./util/concat.ts";

const env = await loadEnv();
const BOT_TOKEN = env["TELEGRAM_BOT_TOKEN"];
if (!BOT_TOKEN) throw new Error("Bot token is not provided");

const SUCCESS_STICKER =
  "CAACAgIAAxkBAAM3ZjJfXjjA2f2b6XQxe4XaQmKNxeIAAvs3AAI5gHFKJrwazBIUrX00BA";
const FAILURE_STICKER =
  "CAACAgIAAxkBAAIBpGYztc_X1JsfBV5RJDIH61eFCxgnAAK7TgACzgxoSqALpFdC2ekCNAQ";

const io = new Server<ServerListenEvents, ServerSentEvents>({
  cors: {
    origin: "*",
  },
  serveClient: false,
  connectionStateRecovery: {},
  transports: ["websocket"],
});

io.use((socket, next) => {
  const { token } = socket.handshake.auth;
  if (typeof token !== "string" || !/^[A-Z1-9]{5}$/.test(token)) {
    return next(new Error("Token missing"));
  }

  socket.join([token]);

  next();
});

io.on("connection", (socket) => {
  console.log("connection", socket.id);

  socket.on("disconnect", () => {
    console.log("disconnect");
  });
});

io.listen(4000);

const bot = new Telegraf(BOT_TOKEN);

// error handler
bot.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error(error);
    await ctx.replyWithSticker(FAILURE_STICKER);
    await ctx.reply("Unexpected Error: " + error.message);
  }
});

bot.on(message("sticker"), async (ctx) => {
  await ctx.replyWithMarkdownV2(
    `fileId: \`${ctx.message.sticker.file_id}\``,
  );
});

bot.command("token", async (ctx) => {
  console.log("/token", ctx.chat.id);

  const token = await generateToken(ctx.chat.id);
  console.log("  set token", token);

  await ctx.reply("Token für diesen Chat: " + token);
});

function getAudio(message: Message): Voice | Audio | null {
  if ("voice" in message) {
    return message.voice;
  } else if ("audio" in message) {
    return message.audio;
  } else {
    return null;
  }
}

bot.command("jingle", async (ctx) => {
  console.log("/jingle", ctx.chat.id);

  if (!ctx.message.reply_to_message) {
    return await ctx.reply(
      "Antworte mit /jingle bitte auf eine Sprachnachricht oder Audiodatei",
    );
  }

  const voice = getAudio(ctx.message.reply_to_message);
  if (!voice) {
    return await ctx.reply(
      "Antworte mit /jingle bitte nur auf eine Sprachnachricht oder Audiodatei",
    );
  }

  await setJingle(ctx.chat.id, voice);

  console.log("  set jingle", voice.file_id);
  await ctx.replyWithSticker(SUCCESS_STICKER);
});

bot.command("deljingle", async (ctx) => {
  console.log("/deljingle", ctx.chat.id);

  await delJingle(ctx.chat.id);

  console.log("  deleted jingle");
  await ctx.replyWithSticker(SUCCESS_STICKER);
});

bot.command("play", async (ctx) => {
  console.log("/play", ctx.chat.id);

  const token = await getToken(ctx.chat.id);
  if (!token) {
    return await ctx.reply(
      "Du hast noch keinen Client verbunden. Sende /token um einen Token für diesen Chat zu bekommen.",
    );
  }

  if (!ctx.message.reply_to_message) {
    return await ctx.reply(
      "Antworte mit /play bitte auf eine Sprachnachricht oder Audiodatei",
    );
  }

  const voice = getAudio(ctx.message.reply_to_message);
  if (!voice) {
    return await ctx.reply(
      "Antworte mit /play bitte nur auf eine Sprachnachricht oder Audiodatei",
    );
  }

  const jingle = await getJingle(ctx.chat.id);

  const files = [jingle, voice].filter(Boolean) as (Voice | Audio)[];
  const filesData = await Promise.all(
    files.map(async (file) => {
      const url = await ctx.telegram.getFileLink(file);
      return await convert(url);
    }),
  );
  const concatData = concatUint8Arrays(filesData);

  const socketIds = new Set((await io.in(token).fetchSockets()).map(
    (socket) => socket.id,
  ));
  if (socketIds.size === 0) {
    return await ctx.reply("Es sind keine Clients verbunden.");
  }

  await ctx.replyWithSticker(SUCCESS_STICKER);
  await ctx.reply(`Sende an ${socketIds.size} Clients...`);

  (async () => {
    const eventId = crypto.randomUUID();
    console.log(
      "  emit prepare to %d clients, eventId %s, %d bytes",
      socketIds.size,
      eventId,
      concatData.byteLength,
    );

    const prepareResponses = await new Promise<string[]>((resolve) =>
      io.in(token).timeout(10_000).emit(
        "prepare",
        eventId,
        concatData,
        (error, responses) => {
          if (error) {
            console.error(error);
          }
          resolve(responses.map((response) => response.socketId));
        },
      )
    );
    const successfulPrepareSockets = new Set(prepareResponses);

    console.log("  prepared %d clients", successfulPrepareSockets.size);
    console.log(
      "  emit play to %d clients, eventId %s",
      successfulPrepareSockets.size,
      eventId,
    );

    const playResponses = await new Promise<string[]>((resolve) => {
      const audioDuration = files.reduce((p, audio) => {
        return p + audio.duration + 1;
      }, 0) * 1000;

      io.in(prepareResponses).timeout(audioDuration + 2000).emit(
        "play",
        eventId,
        (error, responses) => {
          if (error) {
            console.error(error);
          }
          resolve(
            responses.filter((response) => response.success).map((response) =>
              response.socketId
            ),
          );
        },
      );
    });
    const successfulPlaySockets = new Set(playResponses);

    console.log("  played %d clients", successfulPlaySockets.size);
    await ctx.reply(
      `${successfulPrepareSockets.size} Clients haben erfolgreich geantwortet, davon ${successfulPlaySockets.size} Clients erfolgreich zuende.`,
    );
  })();
});

bot.command("stop", async (ctx) => {
  const token = await getToken(ctx.chat.id);
  if (!token) {
    return await ctx.reply(
      "Du hast noch keinen Client verbunden. Sende /token um einen Token für diesen Chat zu bekommen.",
    );
  }

  const socketIds = new Set((await io.in(token).fetchSockets()).map(
    (socket) => socket.id,
  ));
  if (socketIds.size === 0) {
    return await ctx.reply("Es sind keine Clients verbunden.");
  }

  const stopResponses = await new Promise<string[]>((resolve) =>
    io.in(token).timeout(5_000).emit(
      "stop",
      (error, responses) => {
        if (error) {
          console.error(error);
        }
        resolve(responses.map((response) => response.socketId));
      },
    )
  );
  const successfulStopSockets = new Set(stopResponses);

  const failedSockets = socketIds.difference(successfulStopSockets);
  if (failedSockets.size === 0) {
    await ctx.reply("Alle Clients haben erfolgreich gestoppt.");
  } else {
    await ctx.reply(
      `${failedSockets.size} von ${socketIds.size} Clients konnten nicht gestoppt werden.`,
    );
  }
});

bot.launch();

// Enable graceful stop
globalThis.addEventListener("unload", () => {
  bot.stop("unload");
});
