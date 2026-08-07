# Behind Closed Doors Karaoke

A static, deploy-ready karaoke request and queue prototype reconstructed from the photographed TJ POP catalog pages 262–291.

## Included
- **4,196 songs** (A Day in the Life through You Are the Reason)
- Search title, artist, and genre
- Sort by title, artist, and genre
- A–Z jump rail and automatic result loading while scrolling
- Broad genre filters plus a Duets filter
- "Karaoke Legend" tags sourced from [Singa's 2026 US Top 100](https://singa.com/blog/100-most-popular-karaoke-songs-united-states/)
- Shared singer account names with optional passwords and persistent device login
- Personal favorites with reorder and remove controls
- A Supabase-backed public list of the night's song requests and queue
- Host approval into queue
- Drag/reorder queue plus touch-friendly up/down buttons
- Done action records the song in that singer's history
- Local JSON export of the night state

## Run locally
Open `index.html` directly in a modern browser.

## Deploy
Upload the folder to any static host (GitHub Pages, Netlify, Cloudflare Pages, etc.).

## Storage
Singer account names and the current night's requests/queue are shared through Supabase. Favorites, personal history, and the remembered device session stay private in that browser's `localStorage`.

## Genre tagging
Genres are broad automated venue categories (not a canonical musicology database). The production version should expose staff tag editing and persist corrections server-side.
