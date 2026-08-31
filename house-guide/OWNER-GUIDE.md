# BCD House Guide — owner/operator guide

## What is running

The always-on Windows computer runs two local processes:

1. Ollama serves the local `llama3.2:3b` model on `127.0.0.1:11434`.
2. `bot.mjs` checks BCD's Supabase chat every four seconds. It reads the complete rolling 80-minute room window, but generates a reply only when a message summons `@BCD`, `@House`, `@Doorman`, `Hey BCD,`, or `Ask BCD:`.

The computer only makes outbound connections. No router port-forwarding, inbound firewall rule, public IP, or Cloudflare tunnel is required.

## Daily operation

- Leave the computer connected to power and internet.
- The display may turn off; the computer itself must not sleep while plugged in. The installed Startup shortcuts run after this Windows account signs in.
- Ollama unloads the model five minutes after the last answer, reducing idle GPU memory and power.
- Administrators can open **Admin settings → BCD Chatbot** on the website to turn the House Guide on or off for the whole room. The PC notices within about 15 seconds.
- Look in `logs/house-guide.log` and `logs/ollama.log` when troubleshooting.
- When the website switch is off, the bot does not read room chat or wake the language model; it checks only the tiny shared on/off flag. To stop every local process, end the `node.exe` bot process and the Ollama process in Task Manager, or shut down the computer.

## Updating public BCD knowledge

Edit the JSON files in `knowledge/`. Keep valid JSON punctuation and add only facts intended to be shared with the club.

- `house.json`: venue, staff-approved facts, events, and opt-in regular profiles.
- `menu.json`: drinks and public bar information.
- `../songs.json`: the karaoke catalog used by both the website and the guide.

Restart the bot after editing knowledge. Temporary room chat is never copied into these files.

## Power-conscious settings

- Keep `MODEL_KEEP_ALIVE=5m` so the model leaves memory after quiet periods.
- Keep replies short and `POLL_INTERVAL_MS` at 4000 or higher.
- Keep `SETTINGS_POLL_INTERVAL_MS` at 15000 or higher so the off state uses only a very small network check.
- Let Windows turn off the display after five minutes.
- Use Windows Best power efficiency while plugged in if response speed remains acceptable.
- Do not disable cooling fans or block ventilation when placing a laptop beneath the router.
- For a permanent mini PC, use wired Ethernet and enable “restore power after AC loss” in its BIOS/UEFI if available.
- For true unattended recovery after a power outage, configure the permanent computer to sign into its dedicated BCD Windows account automatically; this current example PC intentionally does not change login/security settings.

## Transfer to another Windows computer

1. Install current NVIDIA/AMD drivers when applicable, Node.js 22+, and Ollama.
2. Copy the full website repository, including `house-guide/` and its untracked `.env` file, through a secure local drive.
3. Run `ollama pull llama3.2:3b`.
4. Run `npm test` from `house-guide/`.
5. Start Ollama, then run `node bot.mjs --health` and `node bot.mjs`.
6. Create Windows Startup shortcuts for `start-house-guide.cmd` and `start-bot.cmd`, using paths from the new computer. The bot shortcut should start about 15 seconds after Ollama.

Never commit `house-guide/.env` if it later contains a secret service-role key. The current key is a publishable frontend key, but keeping runtime configuration out of Git makes future upgrades safer.
