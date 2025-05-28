import { Telegraf } from "npm:telegraf";
import type { Audio, Message, Voice } from "npm:@telegraf/types";
import { debounce } from "@std/async/debounce";

import { delJingle, getJingle, setJingle } from "./util/entities/jingle.ts";
import { convert } from "./util/convert.ts";
import { concatUint8Arrays } from "./util/concat.ts";
import { execute } from "./util/execute.ts";
import { CombinedPlayer } from "./CombinedPlayer.ts";
import {
  BOT_TOKEN,
  FAILURE_STICKER,
  GROUP_IDS,
  HEARTBEAT_INTERVAL,
  HEARTBEAT_URL,
  SUCCESS_STICKER,
  WEBHOOK,
} from "./env.ts";
import { setAsyncInterval } from "./util/setAsyncInterval.ts";

if (!await execute("aplay", ["-L"])) {
  console.error(
    "ERROR: Install aplay first. On Debian based systems: apt-get install alsa-base alsa-utils",
  );
  Deno.exit(127);
}

// some constants
const HANDLER_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const INACTIVE_TIMEOUT = 1000 * 3600 + 10_000; // 1 hour + 10 seconds (for heartbeat ping)
const MSG_TIMEOUT = 1000 * 3600; // 1 hour
const FILE_SIZE_LIMIT = 1024 * 1024 * 20; // 20MB

// restart bot after 1 hour of inactivity, just to be sure it doesn't hang
const resetInactiveTimeout = debounce((bot: Telegraf) => {
  console.log(">>> inactive timeout, stopping bot...");
  bot.stop("inactive");
  Deno.exit(0);
}, INACTIVE_TIMEOUT);

const player = new CombinedPlayer();
const bot = new Telegraf(BOT_TOKEN, {
  handlerTimeout: HANDLER_TIMEOUT,
});

bot.command("chatid", async (ctx) => {
  return await ctx.reply(`Chat ID: ${ctx.chat.id}`);
});

bot.use(async (ctx, next) => {
  resetInactiveTimeout(bot);

  // discard messages from unknown chats
  if (!ctx.chat || (GROUP_IDS && !GROUP_IDS.has(ctx.chat.id))) {
    return;
  }

  // discard messages older than 1 hour
  if (!ctx.message || ctx.message.date < (Date.now() - MSG_TIMEOUT) / 1000) {
    return;
  }

  try {
    await next();
  } catch (error) {
    console.error("!!! error during event processing:", error);
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
      "Please reply with /jingle to a voice message or audio file",
    );
  }

  const voice = getAudio(ctx.message.reply_to_message as Message);
  if (!voice) {
    return await ctx.reply(
      "Please reply with /jingle **only** to a voice message or audio file",
    );
  }

  if ((voice.file_size ?? 0) > FILE_SIZE_LIMIT) {
    return await ctx.reply(
      "The audio file cannot be larger than 20MB due to Telegram API limitations.",
    );
  }

  await setJingle(ctx.chat.id, voice);

  console.log("  set jingle", voice.file_id);
  if (SUCCESS_STICKER) {
    await ctx.replyWithSticker(SUCCESS_STICKER);
  } else {
    await ctx.reply("Jingle saved.");
  }
});

bot.command("deljingle", async (ctx) => {
  console.log("/deljingle", ctx.chat.id);

  await delJingle(ctx.chat.id);

  console.log("  deleted jingle");
  if (SUCCESS_STICKER) {
    await ctx.replyWithSticker(SUCCESS_STICKER);
  } else {
    await ctx.reply("Jingle deleted.");
  }
});

bot.command("play", async (ctx) => {
  console.log("/play", ctx.chat.id);

  if (!ctx.message.reply_to_message) {
    return await ctx.reply(
      "Please reply with /play to a voice message or audio file",
    );
  }

  const voice = getAudio(ctx.message.reply_to_message as Message);
  if (!voice) {
    return await ctx.reply(
      "Please reply with /play **only** to a voice message or audio file",
    );
  }

  if ((voice.file_size ?? 0) > FILE_SIZE_LIMIT) {
    return await ctx.reply(
      "The audio file cannot be larger than 20MB due to Telegram API limitations.",
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
  await ctx.reply(`Playing...`);

  // decouple from async execution context fix timeouts
  (async () => {
    try {
      console.log(
        "  prepare, eventId %d, %d bytes",
        ctx.msgId,
        concatData.byteLength,
      );

      const notInterrupted = await player.play(ctx.msgId, concatData.buffer);

      console.log("  played, not interrupted %s", notInterrupted);
      if (notInterrupted) {
        await ctx.reply("Played successfully.");
      }
    } catch (error) {
      console.error("!!! playing failed: ", error);
      await ctx.reply("Playing failed for some reason.");
    }
  })();
});

bot.command("stop", async (ctx) => {
  player.stop();
  await ctx.reply("Stopped successfully.");
});

bot.catch((err) => {
  console.error("!!! error in bot: ", err);
  bot.stop("error");
  Deno.exit(2);
});

// Enable graceful stop
Deno.addSignalListener("SIGINT", () => {
  console.log(">>> stopping bot...");
  bot.stop("stop");
  Deno.exit(0);
});

// finally launch the bot
try {
  const launchOptions: Telegraf.LaunchOptions = {
    webhook: WEBHOOK
      ? {
        domain: WEBHOOK.DOMAIN,
        port: WEBHOOK.PORT,
        secretToken: WEBHOOK.SECRET,
      }
      : undefined,
  };

  if (WEBHOOK) {
    console.log(">>> launching using webhook server...");
  } else {
    console.log(">>> launching using long polling...");
  }

  await bot.launch(launchOptions, () => {
    console.log(
      ">>> launched, group ids [%s]",
      [...GROUP_IDS ?? []],
    );

    resetInactiveTimeout(bot);

    if (HEARTBEAT_URL) {
      setAsyncInterval(
        async () => {
          try {
            // check if bot can reach the outside
            const startTime = Date.now();
            await bot.telegram.getMe();
            const endTime = Date.now();
            const ping = endTime - startTime;
            // send heartbeat ping to monitoring service
            await fetch(HEARTBEAT_URL! + `&ping=${ping}`);
            console.log(`<<< heartbeat, ping: ${ping}ms`);
          } catch (error) {
            console.error("!!! internet down", error);
          }
        },
        {
          interval: HEARTBEAT_INTERVAL,
          immediate: true,
        },
      );
    }
  });
} catch (error) {
  console.error("!!! error launching bot", error);
  Deno.exit(1);
}
