import "@std/dotenv/load";

function missing(message: string): never {
  throw new Error(message);
}

export const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ??
  missing("Bot token is not provided. BOT_TOKEN");

export const HEARTBEAT_URL = Deno.env.get("HEARTBEAT_URL");

const GROUP_IDS_STR = Deno.env.get("GROUP_IDS");
export const GROUP_IDS = GROUP_IDS_STR
  ? new Set<number>(GROUP_IDS_STR.split(",").map((str) => parseInt(str)))
  : null;

export const SUCCESS_STICKER = Deno.env.get("SUCCESS_STICKER_ID");
export const FAILURE_STICKER = Deno.env.get("FAILURE_STICKER_ID");
