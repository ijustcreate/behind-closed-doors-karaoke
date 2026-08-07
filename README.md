# Behind Closed Doors Karaoke

A static, deploy-ready karaoke request and queue prototype reconstructed from the photographed TJ POP catalog pages 262–291.

## Included
- **4,196 songs** (A Day in the Life through You Are the Reason)
- Search title, artist, TJ number, and genre
- Sort by title, artist, genre, duet/feature, and number
- Broad genre tags and duet/feature flags
- Local singer profiles
- Persistent song requests
- Host approval into queue
- Drag/reorder queue plus touch-friendly up/down buttons
- Done action records the song in that singer's history
- Local JSON export of the night state

## Run locally
Open `index.html` directly in a modern browser.

## Deploy
Upload the folder to any static host (GitHub Pages, Netlify, Cloudflare Pages, etc.).

## Important production note
This prototype uses `localStorage`, so accounts, requests, and queue state are shared only within the same browser profile. For a real venue where guests request from their phones and staff manage a shared queue, replace the storage layer with Supabase/Firebase/Postgres + realtime subscriptions.

## Genre tagging
Genres are broad automated venue categories (not a canonical musicology database). The production version should expose staff tag editing and persist corrections server-side.
