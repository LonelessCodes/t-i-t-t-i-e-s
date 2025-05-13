import { load as loadEnv } from "https://deno.land/std@0.223.0/dotenv/mod.ts";

const env = await loadEnv();

export const BOT_TOKEN = env["TELEGRAM_BOT_TOKEN"] ??
  Deno.env.get("TELEGRAM_BOT_TOKEN") ?? null;

export const HEARTBEAT_URL = env["HEARTBEAT_URL"] ??
  Deno.env.get("HEARTBEAT_URL") ?? null;

const GROUP_IDS_STR = env["GROUP_IDS"] ?? Deno.env.get("GROUP_IDS") ?? null;
export const GROUP_IDS = GROUP_IDS_STR
  ? new Set<number>(GROUP_IDS_STR.split(",").map((str) => parseInt(str)))
  : null;
