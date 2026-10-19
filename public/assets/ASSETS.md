# Artwork

Artwork was generated with the built-in Image Gen tool and prepared with Sharp outside the game. Neither tool is used at runtime or added as a game dependency.

- `characters/boy-eight-directions.png`: the only player sheet, a transparent 72 × 160 PNG containing 24 × 32 frames in three columns and five rows. Rows face down, left, up, down-left and up-left; columns are idle and two walking poses. Right-facing directions mirror the corresponding left-facing row through `src/content/game.json`. All frames have a common foot baseline, with one transparent pixel below the feet. Edit or replace in Piskel or Aseprite, keeping the layout and alignment; update the JSON if changing the layout.
- `terrain/grass.png`: repeating 128 × 128 PNG. Edit or replace with a seamless terrain tile.

The player is a boy with dark brown curtain hair parted in the centre, a white T-shirt with a red dragon on the back, black jeans, and black Vans-style skate shoes with white soles. At this resolution, the dragon and shoe details are suggestive pixel accents. The superseded farmer sheets are available in Git history and are not needed by the game.

## Boy source prompt

Generated using the previous farmer sheet as an edit target and style/layout reference. Each sprite was trimmed, resized with nearest-neighbour sampling to fit 22 × 30 pixels, centred in its cell and aligned at the feet. The final sheet uses binary transparency and a 32-colour palette.

Use case: precise-object-edit.
Asset type: production pixel-art character sprite sheet for the existing Danville top-down game.
Input image: edit target and reference for frame layout, scale, perspective and pixel-art style. Replace the farmer's appearance throughout ALL fifteen frames.
Primary request: a boy with dark brown, medium-long curtain hair with a clear centre part, a white short-sleeved T-shirt with a small dark green dragon graphic ONLY on the BACK, black jeans, and black Vans-style low-top skate shoes with white soles and a tiny white side stripe. No hat, no dungarees, no boots. Plain white front of shirt. Hair hangs to ears with parted longer fringe, not spiky.
Exact composition: THREE equal columns and FIVE equal rows, FIFTEEN separate sprites. Rows top to bottom: DOWN/front; LEFT/side profile; UP/back; DOWN-LEFT/front three-quarter; UP-LEFT/back three-quarter. All side and diagonal views face LEFT. Columns in EVERY row: idle standing; walking with one foot forward; walking with the other foot forward. Clear alternating walking poses.
Style: preserve reference's slightly elevated top-down RPG viewpoint, small round head, short compact body and crisp chunky low-resolution square pixels, dark outlines, limited flat palette. Character designed to read within 24x32 logical pixels; dragon is a tiny suggestive green pixel motif, not detailed illustration.
Constraints: identical character, proportions, scale and consistent foot baseline in all cells; ample fully transparent padding separating cells. Upright heads and bodies, entire sprite contained in each cell, no shared pixels between cells. Portrait sheet 3:5 aspect ratio. Preserve five-row animation structure exactly. Transparent alpha background, no scenery, no shadows, no grid lines, no text, no labels, no watermark. The back-facing rows show the dragon; front-facing rows show plain white shirt.

### Red dragon revision

A second built-in Image Gen edit changed only the dragon graphic from dark green to strong crimson red in all six back-visible sprites (third and fifth rows), preserving the five-row layout, poses, appearance, padding and transparent background.

## Grass source prompt

Use case: stylized-concept. Production terrain texture for an extremely bare top-down pixel art farming RPG. Square seamless tile of plain spring green grass, base color approximately #72a449, subtle sparse small 1-2 pixel flecks of lighter and darker greens and very occasional tiny three-pixel grass tufts. The entire image is flat even green grass, no objects, no flowers, no stones, no paths, no gradients, no lighting, no borders, no text, no checkerboard. Crisp chunky square pixels, designed as 128x128 logical pixels nearest-neighbor enlarged. Low contrast, very understated texture; continuous green surface from edge to edge and seamless tiling.
