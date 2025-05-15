import "@std/dotenv/load";

function missing(message: string): never {
  throw new Error(message);
}

export const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ??
  missing("Bot token is not provided. BOT_TOKEN");

// Optional heartbeat URL push
export const HEARTBEAT_URL = Deno.env.get("HEARTBEAT_URL");

const HEARTBEAT_INTERVAL_RAW =
  parseInt(Deno.env.get("HEARTBEAT_INTERVAL") ?? "60") * 1000;
export const HEARTBEAT_INTERVAL = isNaN(HEARTBEAT_INTERVAL_RAW)
  ? missing(
    "HEARTBEAT_INTERVAL must be a number. Got: " + HEARTBEAT_INTERVAL_RAW,
  )
  : HEARTBEAT_INTERVAL_RAW;

// Optional restriction to group IDs
const GROUP_IDS_STR = Deno.env.get("GROUP_IDS");
export const GROUP_IDS = GROUP_IDS_STR
  ? new Set<number>(GROUP_IDS_STR.split(",").map((str) => parseInt(str)))
  : null;

// Optional stickers
export const SUCCESS_STICKER = Deno.env.get("SUCCESS_STICKER_ID");
export const FAILURE_STICKER = Deno.env.get("FAILURE_STICKER_ID");

// Optional webhook setup
// Either all or none of these should be set
const WEBHOOK_DOMAIN = Deno.env.get("WEBHOOK_DOMAIN");
const WEBHOOK_PORT_STR = parseInt(
  Deno.env.get("WEBHOOK_PORT") || "8080",
);
const WEBHOOK_PORT = isNaN(WEBHOOK_PORT_STR)
  ? missing("WEBHOOK_PORT must be a number. Got: " + WEBHOOK_PORT_STR)
  : WEBHOOK_PORT_STR;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");

export const WEBHOOK = WEBHOOK_DOMAIN && WEBHOOK_PORT && WEBHOOK_SECRET
  ? {
    DOMAIN: WEBHOOK_DOMAIN,
    PORT: WEBHOOK_PORT,
    SECRET: WEBHOOK_SECRET,
  }
  : null;
