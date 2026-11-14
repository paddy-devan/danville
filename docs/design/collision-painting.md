# Painting Town collisions

1. From Grassland, press **M** and choose **Town**. Press **E** to open the collision painter.
2. Choose **Walkable** or **Blocked** and adjust the brush size. Drag over the ground to paint. Blue marks walkable ground; red marks blocked ground. Paint the ground beneath the player's feet, including the full usable width of paths and gate openings.
3. Scroll to zoom around the pointer. Right-drag or middle-drag to pan. **Fit map** shows the whole town again.
4. **Undo**, **Redo** and **Ctrl+Z** / **Ctrl+Shift+Z** work on whole strokes. **Restore map** returns to the collision PNG shipped with the game; this can also be undone while the editor remains open.
5. Click **Playtest** or press **Esc** to apply the mask and resume walking. Press **E** again to continue editing. Foot clearance still applies at edges. If the player was painted into blocked ground, they move to nearby safe ground; a completely blocked map cannot be playtested.

Changes automatically save in this browser after each stroke, undo, redo, restore or import. They persist across reloads and take precedence over the project's mask. They are local editing drafts, not saved player progress, and are not shared with other players. Undo history lasts only while the painter is open, with up to 20 steps. If browser storage is unavailable, editing and playtesting still work for the session; use Export PNG to retain changes.

## Keeping changes in the project

Click **Export PNG** to download `town-collision.png`. It is an opaque 1,536 by 1,024 image: **white is walkable**, **black is blocked**. Replace [public/assets/maps/town-collision.png](../../public/assets/maps/town-collision.png) with the exported file and reload the game. To view the newly shipped file instead of an older browser draft, open the editor and choose **Restore map**, then **Playtest**.

**Import PNG** loads an existing mask for further painting. It must match the town's image dimensions. Light pixels become walkable; dark or transparent pixels become blocked. The import can be undone. You can also edit the PNG in an external image editor; keep its dimensions, alignment and black/white ground markings.

The `layout.mask` path in `src/content/game.json` selects the shipped PNG. Town's JSON still defines building names, door approaches, exits, brush-independent foot clearance and a polygon-based fallback if a level has no mask configured. When a mask is configured, paint it to change collisions; the fallback polygons do not override painted pixels. Changing scenery still requires updating the background artwork separately.
