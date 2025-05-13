import { Telegraf } from "npm:telegraf";
import type { Audio, Message, Voice } from "npm:@telegraf/types";

import { delJingle, getJingle, setJingle } from "../server/entities/jingle.ts";
import { convert } from "../server/util/convert.ts";
import { concatUint8Arrays } from "../server/util/concat.ts";
import { execute } from "../util/execute.ts";
import { playCombined, stopCombined } from "./player.ts";
import {
  BOT_TOKEN,
  FAILURE_STICKER,
  GROUP_IDS,
  HEARTBEAT_URL,
  SUCCESS_STICKER,
} from "./env.ts";

if (!BOT_TOKEN) throw new Error("Bot token is not provided. BOT_TOKEN");

if (!await execute("aplay", ["-L"])) {
  console.error(
    "ERROR: Install aplay first. On Debian based systems: apt-get install alsa-base alsa-utils",
  );
  Deno.exit(1);
}

const bot = new Telegraf(BOT_TOKEN, {
  handlerTimeout: 5 * 60 * 1000,
});

// error handler
bot.use(async (ctx, next) => {
  if (!ctx.chat || (GROUP_IDS && !GROUP_IDS.has(ctx.chat.id))) {
    return;
  }

  if (!ctx.message || ctx.message?.date < (Date.now() / 1000) - 3600) {
    return;
  }

  try {
    await next();
  } catch (error) {
    console.error(error);
    if (FAILURE_STICKER) {
      await ctx.replyWithSticker(FAILURE_STICKER);
    }
    await ctx.reply("Unexpected Error: " + String(error));
  }
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

  if ((voice.file_size ?? 0) > 1024 * 1024 * 20) {
    return await ctx.reply(
      "Die Audiodatei kann nicht größer als 20MB sein, weil Telegram API doof...",
    );
  }

  await setJingle(ctx.chat.id, voice);

  console.log("  set jingle", voice.file_id);
  if (SUCCESS_STICKER) {
    await ctx.replyWithSticker(SUCCESS_STICKER);
  } else {
    await ctx.reply("Jingle gespeichert.");
  }
});

bot.command("deljingle", async (ctx) => {
  console.log("/deljingle", ctx.chat.id);

  await delJingle(ctx.chat.id);

  console.log("  deleted jingle");
  if (SUCCESS_STICKER) {
    await ctx.replyWithSticker(SUCCESS_STICKER);
  } else {
    await ctx.reply("Jingle gelöscht.");
  }
});

bot.command("play", async (ctx) => {
  console.log("/play", ctx.chat.id);

  if (!ctx.message.reply_to_message) {
    return await ctx.reply(
      "Antworte mit /play bitte auf eine Sprachnachricht oder Audiodatei",
    );
  }

  const voice = getAudio(ctx.message.reply_to_message);
  if (!voice) {
    return await ctx.reply(
      "Antworte mit /play bitte **nur** auf eine Sprachnachricht oder Audiodatei",
    );
  }

  if ((voice.file_size ?? 0) > 1024 * 1024 * 20) {
    return await ctx.reply(
      "Die Audiodatei kann nicht größer als 20MB sein, weil Telegram API doof...",
    );
  }

  await ctx.reply(`Downloading + converting...`);

  const jingle = await getJingle(ctx.chat.id);

  const files = [jingle, voice].filter(Boolean) as (Voice | Audio)[];
  const filesData = await Promise.all(
    files.map(async (file) => {
      const url = await ctx.telegram.getFileLink(file);
      return (await convert(url.toString()));
    }),
  );
  const concatData = concatUint8Arrays(filesData);

  if (SUCCESS_STICKER) {
    await ctx.replyWithSticker(SUCCESS_STICKER);
  }
  await ctx.reply(`Spiele ab...`);

  (async () => {
    try {
      console.log(
        "  prepare, eventId %d, %d bytes",
        ctx.msgId,
        concatData.byteLength,
      );

      const notInterrupted = await playCombined(ctx.msgId, concatData.buffer);

      console.log("  played, not interrupted %s", notInterrupted);
      if (notInterrupted) {
        await ctx.reply("Erfolgreich zuende gespielt.");
      }
    } catch (error) {
      console.error("playing failed: ", error);
    }
  })();
});

bot.command("stop", async (ctx) => {
  stopCombined();
  await ctx.reply("Erfolgreich gestoppt.");
});

// Enable graceful stop
globalThis.addEventListener("unload", () => {
  bot.stop("unload");
});

async function pushHeartbeat() {
  try {
    await bot.telegram.getMe();
    await fetch(HEARTBEAT_URL);
  } catch (error) {
    console.error("internet down", error);
  }
}

if (HEARTBEAT_URL) {
  setInterval(pushHeartbeat, 60 * 1000);
  pushHeartbeat();
}

for (;;) {
  try {
    await bot.launch(() => {
      console.log(
        ">>> launched, group ids [%s]",
        [...GROUP_IDS ?? []],
      );

      // restart every 12 hours, just to be sure it doesn't hang
      setTimeout(() => {
        console.log(">>> Restarting bot...");
        bot.stop("restart");
        Deno.exit(0);
      }, 1000 * 3600 * 12);
    });
    break;
  } catch (error) {
    console.error(error);

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
