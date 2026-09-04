# Encore Royale progress

Original prompt: Remove custom characters; rename Celestefall to BCDKC Encore Royale; restore a real-time drop-in server with up to eight players; give the player three health; add capture zones, capture achievements, and a first-PK "Killer Note" achievement; use Ash and P2 with tintable red/blue channels and eight player colors; notify joins; fix mirrored bats and floating slugs; implement and push.

## 2026-09-03

- Began multiplayer/capture objective implementation audit.
- Existing client is a fixed-step local arena; Supabase is already used by the parent BCD app, but Encore Royale has no network client or backend yet.

## 2026-09-03 — Encore Royal room work

- Identified the deployed game as the separate `ijustcreate/Celestefall` GitHub Pages repository; its `docs/` build contains the bats, slugs, Ash/P2 rigs, and prior custom-character studio.
- Replaced the player-facing custom-character entry point with Ash/P2 plus eight roster colors, a live Realtime Presence/Broadcast room, an eight-player cap, replicated player movement, join presence, three player health pips, capture zones, and BCD achievement events.
- Updated the BCD launcher to use the BCDKC Encore Royal name, pass only its existing public Supabase client configuration, and award `encore_capture` / `killer_note` through the existing achievement service.
- Corrected bat rig facing and moved slug spawn baselines to floor level.

## TODO

- Implement a safe room-presence and state-sync server path plus client drop-in flow.
- Replace custom fighter selection with Ash/P2 and eight palette choices.
- Add health, capture zones, achievement bridge, and visual enemy fixes.
- Build, exercise with the game Playwright loop, inspect screenshots/text/logs, deploy, and push.
