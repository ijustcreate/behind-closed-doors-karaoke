# Behind Closed Doors Karaoke — Codex Handoff

## Start here

You are taking over an existing static prototype called **Behind Closed Doors Karaoke**. Do not rebuild blindly. First inspect the current implementation, run it, understand the data model and UI, then evolve it into a production-ready multi-device karaoke request and queue system.

### Existing project files
- `index.html` — current full static app
- `songs.json` — 4,196 catalog entries
- `manifest.webmanifest` — PWA manifest
- `sw.js` — service worker
- `README.md` — prototype notes

The current app intentionally uses browser `localStorage`. That is the main architectural constraint to remove.

---

# 1. Product goal

Build a responsive web app for a real karaoke venue named **Behind Closed Doors Karaoke**.

Customers should be able to:
1. Search the karaoke catalog by **song title**, **artist**, **TJ karaoke number**, and **genre**.
2. Sort by title, artist, number, genre, and duet status.
3. Filter for duet/feature songs.
4. Sign in with a persistent singer identity.
5. Request a song to sing.
6. See their pending/queued/completed requests.
7. See their personal history of songs they have sung.
8. Re-request songs they have performed before.

Staff/hosts should be able to:
1. See incoming requests in real time.
2. Approve a request into the active karaoke queue.
3. See **song title, original artist, singer, and TJ number** at a glance.
4. Reorder the queue by drag-and-drop and touch-friendly controls.
5. Mark a queue item **Done**.
6. Remove/cancel a queue item.
7. Persist every completed performance into the singer's history.
8. Have queue changes appear immediately on every connected device.

The app should feel like entering a small, slightly secret late-night speakeasy rather than opening generic SaaS software.

---

# 2. Current prototype behavior to preserve

The current prototype already provides:
- Catalog browsing/searching
- 4,196 songs reconstructed from TJ POP catalog pages 262–291
- Broad genre tags
- Duet/feature flags
- Local singer profiles
- Requests
- Host approval into queue
- Drag/reorder queue
- Up/down queue controls for touch
- Done action
- Song history
- State export
- Responsive dark speakeasy visual treatment

Preserve these behaviors while replacing local-only state with a realtime backend.

**Important:** Existing genre and duet metadata is heuristic, not canonical. Do not silently present it as perfectly authoritative. Build an editing/verification path.

---

# 3. Recommended stack

Use a conventional, maintainable stack. Preferred implementation:

- **Next.js + TypeScript**
- **Supabase** for Postgres, Auth, Row Level Security, and Realtime
- **Tailwind CSS** or CSS modules for UI styling
- `@dnd-kit` for accessible queue reordering
- Zod for runtime validation
- Vitest for unit tests
- Playwright for end-to-end tests

If the existing static app can be cleanly migrated with another equally simple architecture, document the reason before changing this stack.

Avoid unnecessary framework abstraction. This is a venue operations app, not a distributed banking platform wearing a fedora.

---

# 4. Core application areas

## 4.1 Songbook

Primary customer-facing screen.

### Search
One search box should match:
- title
- artist
- TJ number
- genre/tag

Search should be forgiving:
- case-insensitive
- punctuation-insensitive
- partial matches
- accent-insensitive where practical

Examples:
- `queen`
- `bohemian`
- `7745`
- `duet`
- `rock`

### Sort
Support:
- Title A–Z / Z–A
- Artist A–Z / Z–A
- TJ number
- Genre
- Duet first

### Filters
At minimum:
- genre
- duet / feature
- availability

### Song card
Show:
- song title
- original artist
- TJ number prominently
- primary genre
- additional tags when present
- duet/feature badge
- Request button

Do not make catalog results visually noisy. The TJ number must remain easy for staff to identify.

---

## 4.2 Singer accounts

### Low-friction customer flow
Support both:
- **Guest singer**: display name, temporary session
- **Persistent account**: sign-in that retains song history across visits/devices

Recommended persistent auth for v1:
- email magic link, or
- SMS OTP if configured

Do not require a password-heavy registration flow just to sing one song badly at 11:42 PM.

### Singer profile
Show:
- display name
- number of completed performances
- active requests
- favorites (phase 2 is acceptable)
- previous songs
- “Sing again” action

Prevent accidental duplicate active requests for the exact same song by the same singer.

---

## 4.3 Requests

When a customer presses **Request**:
- create a persistent request
- preserve its creation timestamp
- initial status = `pending`
- show it immediately in the customer's My Requests view
- send realtime update to host devices

Statuses:
- `pending`
- `queued`
- `singing`
- `completed`
- `cancelled`
- `removed`
- optional `no_show`

A request must not disappear merely because it leaves the active queue. Preserve request history.

---

## 4.4 Host request inbox

Create a host-only Requests screen.

Each request shows:
- singer
- song title
- artist
- TJ number
- genre
- duet badge
- time requested
- optional singer note

Actions:
- Add to queue
- Reject/cancel
- View singer history

Changes must propagate in realtime.

---

## 4.5 Host queue

This is operationally critical.

Each queue row/card must show, without opening anything:
- queue position
- singer name
- song title
- original artist
- **TJ karaoke number**
- approximate state: waiting / now / done

### Queue interactions
- drag to reorder
- touch-friendly move up/down controls
- keyboard-accessible reorder if practical
- Done button
- Remove button
- optional “Start / Now Singing” action

### Done behavior
When staff presses **Done**:
1. Remove the item from the active queue.
2. Mark its request completed.
3. Create a performance-history record.
4. Increment/update singer history through normal query data, not a fragile client-side counter.
5. Realtime-update customer and staff screens.

### Reordering
Do not use client-only array order.
Queue ordering must be persistent and safe when multiple host devices are open.

Recommended solution:
- queue entry has a server-side `sort_key` / `position`
- execute reorder through a Postgres RPC/transaction
- broadcast resulting order via Supabase Realtime
- resolve simultaneous reorders deterministically

---

## 4.6 Public queue / “Now Singing” display

Build a read-only route suitable for a TV or second monitor:

`/display`

Show:
- Now Singing
- On Deck
- next 3–5 singers
- song title + artist
- optional singer display name

Do **not** show staff controls.

Make it visually theatrical and readable from across a room.

This can be phase 2 if necessary, but structure the backend so it requires no redesign.

---

# 5. Data model

Use UUID primary keys unless there is a compelling reason not to.

## `venues`
- `id`
- `name`
- `slug`
- `created_at`

The initial venue is Behind Closed Doors Karaoke. Design venue scoping now even if only one venue is used.

## `profiles`
- `id` — references auth user when persistent
- `display_name`
- `created_at`
- `updated_at`

For guest sessions, either use anonymous Supabase auth or a clearly isolated guest identity model. Document the choice.

## `staff_memberships`
- `id`
- `venue_id`
- `user_id`
- `role` (`host`, `admin`)

## `songs`
- `id`
- `tj_code` text
- `title`
- `artist`
- `primary_genre`
- `is_duet`
- `is_available` boolean default true
- `source` e.g. `TJ TK-067/067E 2019.10`
- `verified` boolean default false
- `created_at`
- `updated_at`

Do not store TJ number as a numeric type if doing so would make future alphanumeric codes painful.

Create indexes appropriate for title/artist/code search. PostgreSQL trigram indexes are a reasonable option.

## `genres`
- `id`
- `name`
- `slug`

## `song_genres`
- `song_id`
- `genre_id`
- `is_primary`

The current single `genre` value can seed `primary_genre`, but the production model should support multiple genre tags.

## `song_tags`
Optional but recommended for:
- duet
- crowd pleaser
- explicit
- slow
- high energy
- holiday
- Disney
- musical theatre
- metal
- etc.

Use normalized tags rather than embedding increasingly cursed comma-separated text.

## `requests`
- `id`
- `venue_id`
- `singer_id`
- `song_id`
- `status`
- `note` nullable
- `requested_at`
- `updated_at`
- `completed_at` nullable

## `queue_entries`
- `id`
- `venue_id`
- `request_id`
- `sort_key` or `position`
- `state` (`waiting`, `singing`)
- `queued_at`
- `started_at` nullable

Only active queue items belong here.

## `performances`
- `id`
- `venue_id`
- `singer_id`
- `song_id`
- `request_id` nullable
- `performed_at`

This table is the durable history of songs actually sung.

## `favorites`
Phase 2, but schema now if convenient:
- `singer_id`
- `song_id`
- `created_at`

## `song_issues`
Recommended staff feature:
- `id`
- `song_id`
- `venue_id`
- `type` (`bad_audio`, `wrong_version`, `lyrics`, `unavailable`, `other`)
- `note`
- `open`
- timestamps

---

# 6. Permissions / security

Use Supabase RLS.

### Everyone
Can read:
- available songs
- public venue configuration
- public display queue fields

### Signed-in singer
Can:
- read/update own profile
- create own requests
- read own requests/history/favorites
- cancel own pending request if venue allows

Cannot:
- reorder queue
- approve requests
- mark performances complete
- impersonate another singer

### Host/admin
Scoped to assigned venue, can:
- read all venue requests
- modify request status
- add/remove/reorder queue entries
- mark performances complete
- edit song metadata/availability/tags

Do not rely on hidden buttons as authorization.

---

# 7. Seed data migration

The existing `songs.json` contains **4,196 entries** with fields:

```ts
type ExistingSong = {
  id: string;
  title: string;
  artist: string;
  code: string;
  genre: string;
  duet: boolean;
};
```

Write an idempotent seed/import script that maps:
- `code` -> `tj_code`
- `genre` -> initial primary genre
- `duet` -> `is_duet`

Requirements:
- running the import twice must not duplicate songs
- unique key should account for TJ code + version/artist where needed
- generate an import report
- flag suspicious records for manual review instead of deleting them

There are likely OCR/normalization imperfections. Example classes to inspect:
- unexpected single-character titles
- capitalization artifacts
- artist formatting inconsistencies
- featured artist punctuation
- duplicate title + different artist/version

Do **not** deduplicate legitimate different karaoke versions just because titles match.

---

# 8. Genre and duet tagging

The user explicitly wants every song appropriately tagged by genre and sortable/filterable by genre and duet.

Current genre values are broad heuristics. Improve this system in two layers:

### Layer 1 — shipped seed
Preserve the existing genre so every song has something useful immediately.

### Layer 2 — editable taxonomy
Allow admins to edit:
- primary genre
- secondary genres
- duet flag
- tags

Add a staff filtering screen for:
- unverified songs
- genre = unknown
- suspicious metadata

Do not block launch on hand-perfecting all 4,196 rows.

---

# 9. Visual direction

## Brand
**Behind Closed Doors Karaoke**

Mood:
- speakeasy
- low-light cocktail bar
- independent record shop
- brass fixtures
- old paper menu
- velvet booth
- subtle Art Deco geometry
- modern enough to work flawlessly on phones

Avoid:
- casino aesthetics
- fake 1920s clip-art overload
- generic neon karaoke gradients
- cartoon microphones everywhere

### Suggested palette
Use current prototype as reference:
- near-black espresso / coal background
- oxblood / wine accents
- aged brass / muted gold
- parchment text
- muted olive secondary accent

Typography:
- editorial serif for headings
- highly readable sans-serif for controls/data
- monospaced or tabular treatment for TJ codes

Motion:
- restrained
- small fades/slides
- queue state changes can have a subtle brass highlight
- honor `prefers-reduced-motion`

Mobile-first is mandatory.

---

# 10. Navigation

Customer navigation:
- **Songbook**
- **My Requests**
- **My Songs**
- optional **Queue** (public limited view)

Host navigation:
- **Requests**
- **Queue**
- **Songbook**
- **Catalog Admin**
- **Display**

Do not expose full host controls to ordinary singers.

---

# 11. Realtime behavior

Use realtime subscriptions for:
- new requests
- request status changes
- queue additions
- queue reorder
- queue completion/removal
- current singer state

The system should work when:
- customer A requests on iPhone
- host approves on laptop
- TV display updates
- customer A sees status become queued

No refresh should be required.

---

# 12. Offline / degraded mode

The songbook should remain useful if venue Wi-Fi hiccups.

Minimum:
- cache static shell and song catalog where practical
- show explicit offline state
- do not pretend an offline request was successfully accepted by the server

Optional:
- locally queue an unsent request and clearly mark it `Waiting for connection`
- submit when connection returns

Be careful to prevent accidental duplicate submissions.

---

# 13. Accessibility

Required:
- good contrast despite dark palette
- 44px-ish touch targets
- semantic buttons/forms
- visible focus states
- screen-reader labels
- keyboard navigation
- queue reorder has non-drag controls
- reduced-motion support

---

# 14. Testing expectations

## Unit tests
Cover:
- catalog normalization/search
- sort behavior
- duplicate request prevention
- request status transitions
- queue reorder logic
- completed performance creation

## Integration tests
Cover:
- singer requests -> host receives
- host approves -> queue updates
- host reorders -> all clients reflect order
- host Done -> queue entry disappears + performance appears in singer history
- unauthorized singer cannot mutate host queue

## E2E / Playwright
At minimum:
1. Create/sign in singer.
2. Search `Bohemian Rhapsody`.
3. Request it.
4. Host sees request.
5. Host adds it to queue.
6. Reorder it.
7. Mark it Done.
8. Singer sees it in My Songs.

Test mobile viewport, especially current iPhone Safari sizes.

---

# 15. Acceptance criteria for v1

The build is not done until all of the following are true:

- [ ] 4,196 seed songs import successfully.
- [ ] Songbook can search by title, artist, TJ number, and genre.
- [ ] Songbook can sort by title, artist, TJ number, genre, and duet.
- [ ] Genre and duet filters work.
- [ ] Customer can create/use a singer identity.
- [ ] Persistent account can retain performance history.
- [ ] Customer can request a song.
- [ ] Request persists server-side.
- [ ] Host receives requests in realtime.
- [ ] Host can approve a request into the queue.
- [ ] Queue shows title, artist, singer, and TJ number.
- [ ] Host can drag/reorder queue persistently.
- [ ] Host can reorder on touch without drag.
- [ ] Host can remove a queue entry.
- [ ] Host can press Done.
- [ ] Done creates durable performance history.
- [ ] Singer sees completed song in My Songs.
- [ ] Multiple devices stay synchronized without refresh.
- [ ] Host actions are protected by server-side authorization/RLS.
- [ ] UI works cleanly on desktop and iPhone.
- [ ] Existing speakeasy aesthetic is preserved or improved.
- [ ] README includes setup, Supabase migration/seed instructions, test commands, and deployment instructions.

---

# 16. Build order

Work incrementally.

## Phase 0 — audit
1. Run existing static project.
2. Inventory current features and localStorage state shape.
3. Inspect `songs.json` for anomalies.
4. Record migration plan in the README or a short architecture note.

## Phase 1 — application shell
1. Migrate UI to Next.js/TypeScript.
2. Preserve visual identity.
3. Load local song seed.
4. Reimplement catalog search/sort/filter.

## Phase 2 — backend
1. Add Supabase project configuration.
2. Add SQL migrations.
3. Add RLS policies.
4. Write idempotent song import.
5. Add singer auth/profile.

## Phase 3 — requests + realtime queue
1. Persistent requests.
2. Host inbox.
3. Persistent queue.
4. Realtime subscriptions.
5. Safe queue reorder RPC.
6. Done -> performance history.

## Phase 4 — polish
1. PWA/offline catalog.
2. TV display route.
3. Admin metadata correction.
4. Playwright coverage.
5. Responsive/accessibility audit.

Do not attempt every phase in one giant unreviewable commit.

---

# 17. Backlog / strong follow-on ideas

These are **not required to block v1**, but architecture should not make them painful.

### QR table entry
Generate a QR code that opens the venue directly. Customer scans, picks/signs into a singer profile, searches, requests.

### Fair rotation mode
Avoid one singer stacking half the night. Host toggle can interleave requests by singer while still allowing manual overrides.

### Estimated wait
Estimate wait using queue position and configurable average song duration.

### Duet partner wanted
Singer can mark a duet request as `Need a partner`; another singer can claim the second vocal slot.

### Favorites / personal repertoire
Mark songs as:
- Favorite
- Know this one
- Want to try

### Host notes
Private fields such as:
- lower key
- skip intro
- birthday
- first timer
- explicit lyrics warning

### Song quality reports
Host can flag bad audio, bad lyrics, wrong version, or temporarily unavailable tracks.

### Night analytics
- most requested songs
- most sung artists
- genre mix
- average wait
- repeat singers
- unused catalog tracks

### Announcement / break state
TV display can switch to:
- intermission
- last call
- host message
- venue logo

### “Now Singing” share card
Generate a tasteful social card after a performance, opt-in only.

### Key/version metadata
If the karaoke system later supports alternate versions, store key/version metadata without changing core song identity.

---

# 18. Definition of quality

This app will be used in a noisy room, under dim lighting, by people with drinks in one hand and limited patience in the other.

Prioritize:
1. speed
2. legibility
3. low-friction requests
4. queue reliability
5. obvious staff controls
6. recovery from mistakes

A beautiful screen that causes the host to lose the queue is a failed product.

---

# 19. First Codex task

Begin by doing **only** the following:

1. Inspect every existing file.
2. Run the static app and document the current behavior.
3. Inspect `songs.json`, report schema, record count, duplicates, and obvious anomalies.
4. Propose the production repo structure and Supabase schema.
5. Create a migration plan that preserves all working current behavior.
6. Then implement Phase 1 and Phase 2 in small, testable commits/steps.

When uncertain, preserve the existing product behavior and visual language rather than replacing it with a generic dashboard.
