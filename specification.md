# Danville

## Current playable game

Danville is a browser-based, client-side 2D game template using Phaser 4, TypeScript and Vite. It runs locally or as static assets on Cloudflare Workers, with no gameplay backend.

The scene is an empty green field with a subtle pixel grass texture and one boy with dark brown centre-parted curtain hair, a white T-shirt with a red dragon on the back, black jeans and black skate shoes with white soles. It uses a slightly elevated top-down view in the style of classic farming games, rather than a diamond isometric projection. A 480 × 320 logical canvas scales to fit the browser while preserving its aspect ratio and using nearest-neighbour pixel rendering. Extra space is letterboxed. A small HTML hint explains the controls.

Arrow keys move the player in eight directions; two adjacent keys select a diagonal facing and move at the same overall speed as a single key. Opposing keys cancel one another. Walking animates in the facing direction; releasing the keys leaves the player standing and facing the last direction, including diagonals. Releasing one of two adjacent keys returns to the remaining key's cardinal facing. Right-facing views mirror the corresponding left-facing artwork, including both diagonal pairs. Movement uses elapsed time and is bounded so the entire sprite remains within the field. Long frames are limited to 50 ms of movement to prevent jumps after interruptions. The camera is fixed. There are no interactions, obstacles, saving, audio or touch controls.

## Architecture

- `src/main.ts` creates the Phaser game and its scaling settings.
- `src/FieldScene.ts` loads assets, reads keyboard input and renders the ground, player and shadow.
- `src/movement.ts` holds the movement and boundary rules independently of Phaser. Node's built-in test runner verifies these rules with `npm test`.
- `src/content/game.json` defines field dimensions, ground image, player appearance, animation frame indices, walking speed and spawn position.
- `public/assets/` contains ordinary PNG images loaded by Phaser. All assets are local; gameplay makes no external service calls.

## Editing content

Change `src/content/game.json` to adjust movement speed, spawn location or field size. Positions and speed use logical game pixels and pixels per second. Keep the spawn within the field's sprite-sized margins.

The player sheet at `public/assets/characters/boy-eight-directions.png` uses 24 × 32 pixel frames arranged in three columns and five rows. Rows face down, left, up, down-left and up-left; columns show idle, one step and the other step. Frame indices start at zero and read across each row. The JSON maps all eight directions to idle frames, walking sequences and a `flipX` flag. Left/right pairs share frame indices, with `flipX: true` for the right-facing direction: eight views need only five sets of artwork. Replace the PNG with a matching sheet exported from Piskel or Aseprite, or change the frame sizes, mappings and flip flags in the JSON for a different layout. Frames must have consistent foot alignment and transparent padding. Mirroring also flips asymmetric details such as accessories, so characters that need consistent handedness can instead map directions to separate frames.

The grass image at `public/assets/terrain/grass.png` repeats across the field. Replace it with another seamless tile or change its path in the JSON. Artwork provenance and source prompts live in `public/assets/ASSETS.md`. Adding new kinds of gameplay still requires code; changing these existing assets and settings does not.

## Local checks

`npm run typecheck` validates TypeScript, `npm test` checks movement rules, and `npm run build` validates and builds the production files into `dist/`. `npm run preview` serves that build locally. Visual appearance, keyboard input and animations also need browser playtesting.

## Deployment

Cloudflare Workers Builds connects directly to `paddy-devan/danville` on GitHub. Pushes to `main` deploy production; preview builds are enabled for every other branch. Both run `npm test && npm run build` before deployment, so failed tests, TypeScript checks or builds stop publication. Cloudflare runs `npx wrangler deploy` for production and `npx wrangler preview` for branch previews. Branch previews update independently of production.

`wrangler.jsonc` names the Worker `danville`, connects production to `https://danville.co.uk` through a Worker custom domain, enables Worker Previews with an empty `previews` block and publishes only the built `dist/` directory. Cloudflare manages the custom domain's DNS and HTTPS certificate. The production `workers.dev` address remains enabled, and branch previews use their own preview addresses. No server script or Cloudflare Vite plugin is needed. Wrangler is pinned in the development dependencies and `.node-version` selects Node 24 for Cloudflare's build environment. Repository connection, build commands and branch controls live in the Cloudflare dashboard, not a GitHub Actions workflow. Cloudflare manages build authentication; no deployment credentials belong in the repository.
