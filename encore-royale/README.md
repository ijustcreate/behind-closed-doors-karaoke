# Encore Royale

Encore Royale is the isolated game client hidden beneath the Behind Closed Doors Karaoke songbook. The BCD web app owns discovery, authentication, sung-song history, and the curtain reveal. This project owns simulation, controls, rendering, and—later—multiplayer room synchronization.

## Local development

```sh
npm install
npm run dev
```

Open `http://localhost:4173`. Add `?installed=1` to preview the installed-app controller.

## Production build

```sh
npm run build
```

The deployable static client is written to `dist/`. It can be served from GitHub Pages, a subdomain, or copied beside the BCD site. Set `window.ENCORE_ROYALE_URL` in the parent site when deploying the game independently.

## Integration contract

The game announces `{ type: "bcd:encore:ready" }` to its parent. The parent replies with:

```ts
{
  type: "bcd:encore:init",
  payload: {
    playerId: string,
    playerName: string,
    sungSongs: string[],
    installed: boolean,
    roomId: string
  }
}
```

The game can request dismissal using `{ type: "bcd:encore:close" }`. Production authentication should use a short-lived game token—not the karaoke app's Supabase anon key or raw account credentials.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for ownership boundaries and multiplayer seams.

