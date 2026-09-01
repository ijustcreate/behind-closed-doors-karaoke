# BCD House Guide — owner/operator guide

## What is running

The always-on Windows computer runs two local processes:

1. Ollama serves the local `llama3.2:3b` text model and the on-demand `gemma3:4b` image model on `127.0.0.1:11434`.
2. `bot.mjs` checks BCD's Supabase chat every four seconds. It reads the complete rolling 80-minute room window, privately describes new chat images, and runs NudeNet's local sensitive-image check. It still generates a reply only when a message summons `@BCD`, `@House`, `@Doorman`, `Hey BCD,`, or `Ask BCD:`.

The computer only makes outbound connections. No router port-forwarding, inbound firewall rule, public IP, or Cloudflare tunnel is required.

## Daily operation

- Leave the computer connected to power and internet.
- The display may turn off; the computer itself must not sleep while plugged in. The installed Startup shortcuts run after this Windows account signs in.
- Ollama unloads the text model five minutes after the last answer. The image model unloads immediately after each new picture, reducing idle memory and power.
- Administrators can open **Admin settings → BCD Chatbot** on the website to turn the House Guide on or off for the whole room. The PC notices within about 15 seconds.
- Look in `logs/house-guide.log` and `logs/ollama.log` when troubleshooting.
- When the website switch is off, the House Guide does not answer. New pictures are still checked and blurred when necessary so the room's safety layer remains active. To stop every local process, end the `node.exe` bot process and the Ollama process in Task Manager, or shut down the computer.

## Private image understanding

- Image descriptions are stored in a protected table and are never returned to the website, placed in page source, used as image alt text, or displayed to members.
- The House Guide receives those descriptions only as private context for messages still inside the rolling room window.
- Public clients receive only `pending`, `safe`, `sensitive`, or `unknown`. Sensitive and uncertain pictures are blurred until a member taps to reveal them; pending pictures cannot be revealed before the PC checks them.
- The system never identifies a person from appearance or guesses age. The warning says “Potentially sensitive,” not “18+ verified.”
- Analysis records expire with the one-hour message window and are purged by the worker-only endpoint.

## Updating public BCD knowledge

Edit the JSON files in `knowledge/`. Keep valid JSON punctuation and add only facts intended to be shared with the club.

- `house.json`: venue, staff-approved facts, events, and opt-in regular profiles.
- `menu.json`: drinks and public bar information.
- `../songs.json`: the karaoke catalog used by both the website and the guide.

Restart the bot after editing knowledge. Temporary room chat is never copied into these files.

## Power-conscious settings

- Keep `MODEL_KEEP_ALIVE=5m` so the model leaves memory after quiet periods.
- Keep `VISION_KEEP_ALIVE=0` so Gemma leaves memory immediately after processing a new picture.
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
3. Run `ollama pull llama3.2:3b` and `ollama pull gemma3:4b`.
4. From `house-guide/`, run `python -m venv .venv-vision`, then `.venv-vision\\Scripts\\python.exe -m pip install -r requirements-vision.txt`.
5. Run `node configure-vision.mjs`, securely register the resulting hash in Supabase, and never share the generated raw worker secret.
6. Run `npm test` from `house-guide/`.
7. Start Ollama, then run `node bot.mjs --health` and `node bot.mjs`.
8. Create Windows Startup shortcuts for `start-house-guide.cmd` and `start-bot.cmd`, using paths from the new computer. The bot shortcut should start about 15 seconds after Ollama.

Never commit `house-guide/.env`. It contains the private vision-worker secret even though the Supabase key itself remains a publishable frontend key.
