import { customAlphabet } from "jsr:@sitnik/nanoid";

import { kv } from "./db.ts";

const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789", 5); // keine 0, denn diese könnte auch als O gelesen werden

export const getToken = async (chatId: number) => {
  const { value } = await kv.get<string>(["token", chatId]);
  return value;
};

export const generateToken = async (chatId: number) => {
  let { value } = await kv.get<string>(["token", chatId]);
  if (!value) {
    value = nanoid();

    await kv.set(["token", chatId], value);
  }

  return value;
};
