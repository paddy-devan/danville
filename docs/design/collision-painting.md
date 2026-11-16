# Painting world collisions

1. Press **E** in Grassland, Grass Arena Level 1 or Town to open the collision painter. Gameplay pauses. The title identifies the scene being edited.
2. Choose **Walkable** or **Blocked** and adjust the brush size. Drag over the ground to paint. Blue marks walkable ground; red marks blocked ground. Paint the ground beneath the player's feet, including the full usable width of paths and openings.
3. Scroll to zoom around the pointer. Right-drag or middle-drag to pan. **Fit map** shows the whole map again. The painter has its own zoom, separate from the gameplay camera.
4. **Undo**, **Redo** and **Ctrl+Z** / **Ctrl+Shift+Z** work on whole strokes. **Restore map** returns to the scene's default collision mask and can also be undone while the editor remains open.
5. Click **Playtest** or press **Esc** to apply the mask and resume walking. Press **E** again to continue editing. Foot clearance still applies at edges. If the player was painted into blocked ground, they move to nearby safe ground; a completely blocked map cannot be playtested.

The festival preview is generated from the current terrain and props, including the opening tent. It stays in sync with changes to `src/content/props.json`; no map screenshot needs to be updated. The initial mask follows the authored prop footprints and tent walls, leaving paths and other grass open. Painting replaces that mask: Walkable can remove an existing prop collision, and Blocked can add a new wall. It does not move, remove or redraw scenery. Town uses its existing background and shipped mask.

Changes automatically save in this browser after each stroke, undo, redo, restore or import. They persist across reloads and take precedence over the scene's default mask. **Each scene has its own draft**: editing Grass Arena Level 1 does not change the separate Grassland field or Town. Drafts are local editing data, not saved player progress, and are not shared with other players. Undo history lasts only while the painter is open, with up to 20 steps. If browser storage is unavailable, editing and playtesting still work for the session; use Export PNG to retain changes.

## Keeping changes in the project

**Export PNG** downloads an opaque image: **white is walkable**, **black is blocked**.

| Scene | Export filename | Dimensions | Configuration in `src/content/game.json` |
| --- | --- | --- | --- |
| Grassland | `field-collision.png` | 2400 by 1600 | `world.collisionMask` |
| Grass Arena Level 1 | `grass-arena-1-collision.png` | 2400 by 1600 | Matching level's `collisionMask` |
| Town | `town-collision.png` | 1536 by 1024 | Matching level's `layout.mask` |

For a field, save the export in `public/assets/maps/` and add its path to the corresponding setting, for example `"collisionMask": "/assets/maps/grass-arena-1-collision.png"` in the first level. Town already has a configured file: replace [public/assets/maps/town-collision.png](../../public/assets/maps/town-collision.png) with its export. Reload the game, then use **Restore map** and **Playtest** to discard an older browser draft and view the newly shipped mask.

**Import PNG** loads an existing mask for further painting. It must match the current scene's dimensions. Light pixels become walkable; dark or transparent pixels become blocked. The import can be undone. You can also edit a mask in an external image editor; keep its dimensions, alignment and black/white ground markings.

Without a configured field PNG, changing the props changes the generated baseline. An existing browser draft still takes precedence: use **Restore map** to rebuild from the new prop layout. Once a field PNG is configured, update that file when scenery changes. Town's JSON retains building names, door approaches, exits and its polygon-based fallback; these do not override a configured or painted mask.
