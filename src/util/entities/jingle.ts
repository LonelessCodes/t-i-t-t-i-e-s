import { Audio, Voice } from "npm:@telegraf/types";

import { kv } from "./db.ts";

export const setJingle = async (chatId: number, audio: Voice | Audio) => {
  await kv.set(["jingle", chatId], audio);
};
export const getJingle = async (chatId: number) => {
  const { value } = await kv.get<Voice | Audio>(["jingle", chatId]);
  return value;
};
export const delJingle = async (chatId: number) => {
  await kv.delete(["jingle", chatId]);
};
