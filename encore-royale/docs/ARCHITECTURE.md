# Architecture

## Ownership boundary

```text
BCD karaoke site
├── secret-scroll journey and curtain reveal
├── admin preview launcher
├── identity + sung-song selection
└── iframe bridge
    └── Encore Royale client
        ├── bridge/       host communication
        ├── config/       tuned gameplay data
        ├── engine/       reusable loop and input
        ├── game/         simulation and rules
        │   ├── entities/ entity construction
        │   └── systems/  AI and future gameplay systems
        ├── rendering/    Canvas presentation only
        ├── ui/           game chrome + installed controller
        └── types/        shared internal contracts
```

Gameplay state does not read or mutate the parent DOM. The parent sends a sanitized session payload through `postMessage`; the client can therefore run locally, on GitHub Pages, or on a dedicated game domain.

## Fixed simulation

Gameplay advances at 60 fixed updates per second. Rendering is independent. This is required for repeatable tests and is the foundation for eventual client prediction and server reconciliation.

## Multiplayer seam

The first online milestone should add `src/network/RoomClient.ts` and authoritative room messages without rewriting movement or rendering. Supabase Realtime is appropriate for room presence and match events during prototyping. Competitive projectile validation and anti-cheat would eventually move to an authoritative server.

## Asset policy

Characters and effects currently use programmatic pixel rectangles. Future art belongs under `public/assets/` with source files documented separately; rendering code should reference asset IDs rather than product-site paths.

## Deployment

- Preview: GitHub Pages or a branch deploy.
- Production: a same-site path such as `/encore/` is best for PWA/offline behavior.
- Alternate: `encore.bcdkc.example` with an explicit parent-origin allowlist.
- Never pass durable account credentials through the iframe bridge.

