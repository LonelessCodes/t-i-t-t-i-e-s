# Telegram Integrated Tone Transmission Instant Event System, or short: TITTIES

Play voice messages from a Telegram group chat on connected speakers.

> [!TIP]
> On Raspberry Pi 3B+ only Deno 2.2.1 runs fine. Newer versions abort trying to allocate 300+ Gi of memory lol.

> [!IMPORTANT]
> When creating the bot account, don't forget to turn Group Privacy off in the bot settings. (`/mybots` -> `@your_bot` -> `Bot Settings` -> `Group Privacy`)

## Steps:

1. Copy and populate the .env.template
2. Invite the bot into your groupchat (the bot might not have access to voice messages sent before being invited)
3. Send the `/chatid` command in the group chat and set the id in `GROUP_IDS` env variable to restrict access

## Running

`cd standalone && deno task run`
