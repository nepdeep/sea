# Bubble Submarine 🫧

A gentle 3D underwater game for a five-year-old, built with Three.js and Vite.
The whole game (scene, models, textures, sound, UI) is in **`index.html`**, and every mesh, texture and sound is generated in code.

Steer a friendly yellow submarine around a glowing coral diorama, find five hidden sea friends, and bring them to the coral party arch for a bubble-confetti dance.

## Run it

Requires Node 18+.

```bash
npm install
npm run dev        # opens a dev server, e.g. http://localhost:5173 (also on your LAN for tablets)
```

Production build:

```bash
npm run build      # outputs dist/ (relative paths, so it works from any folder or static host)
npm run preview    # serves dist/
```

`index.html` also contains an import map that points `three` at jsDelivr. That means the file can run without Vite from any static web server, e.g. `python3 -m http.server`. It needs to be served over HTTP, not opened as `file://`. This CDN path is untested in the build sandbox because the sandbox has no CDN access. Use the Vite build for offline play.

## How to play (taps or clicks only)

| Tap…                         | What happens                                                             |
|------------------------------|--------------------------------------------------------------------------|
| Open water or seabed         | The submarine glides there slowly and smoothly                           |
| A shell, coral arch or plant with peeking eyes, bubbles and ripples | The friend pops out and swims behind the submarine |
| The glowing pink coral arch  | The submarine goes there; any friends with it settle around the arch     |
| The rainbow shells (front)   | They play musical notes                                                  |
| The pufferfish               | It puffs up, then slowly deflates                                        |
| Jellyfish / the submarine    | A little wobble and giggle                                               |

- The five round portraits at the top start grey. Each fills with colour when its friend is found and gets a gold star once the friend reaches the arch.
- When all five are home, a dance party starts with bubble confetti, colour-changing lights and music. Then a big ↻ button appears. Replay picks new spots, new hiding-place types and new friends in each spot.
- A pointing hand shows the first thing to tap. If the child is idle for a while, it comes back and points at the next hiding place, or at the arch once everyone is found.
- There is no reading, keyboard, timer, oxygen meter, danger or losing.

### Grown-up buttons (top-right)

- **Speaker**: sound on or off. All sound is synthesized with Web Audio and starts after the first tap.
- **Waves**: *calmer effects*. Slower swaying, fewer bubbles and confetti, still light rays, slower dancing and a slower submarine. It is on by default when the device has *reduce motion* turned on.

Both settings are saved in `localStorage`.

## Verification

```bash
npm run verify
```

This starts the Vite dev server and drives the game in headless Chromium with real pointer and touch input at three sizes: 1280×720 desktop, 1024×768 tablet with touch, and 390×844 portrait phone. It checks:

- **Movement**: a tap sets the target, the submarine arrives, its speed stays slow (≤ 3.4 units/s), and a seabed tap keeps it above the sand
- **Collection**: tapping each of the 5 hiding places reveals a different friend, which then follows the sub; the portraits fill in one by one
- **Hints**: the first-action hint points at a hiding place; the idle hint points at the arch once everyone is found
- **Party**: going to the arch marks everyone home, starts the party, launches confetti, and shows the replay button
- **Extras**: the pufferfish inflates, all 5 shell instruments play, mute and calm toggle and persist
- **Replay**: friends are hidden again, portraits are reset, and the hiding-place layout changes
- No page errors

Screenshots go to `test-output/`. Set `CHROMIUM_PATH` if Chromium is somewhere other than `/opt/pw-browsers/chromium`.

## Tech notes

- Three.js r169. Mostly `MeshLambertMaterial`; glows are additive sprites. Static coral is merged with `BufferGeometryUtils.mergeGeometries` to keep draw calls low.
- Seaweed, anemones and jellyfish tentacles sway in the vertex shader through a small `onBeforeCompile` injection.
- Bubbles, confetti and sparkles share one 700-point `Points` system with a custom shader.
- The camera is fixed and side-on. It fits the whole 30-unit-wide diorama to any aspect ratio. Portrait phones get a small rotate-device icon.
- Pixel ratio is capped at 2.
