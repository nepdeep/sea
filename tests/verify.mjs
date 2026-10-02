// End-to-end check for Bubble Submarine.
// Starts the Vite dev server, drives the game in headless Chromium with real
// pointer clicks, and verifies movement, creature collection, the party and replay.
//
//   npm run verify            (screenshots land in ./test-output)
//   CHROMIUM_PATH=/path/to/chrome npm run verify
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';

const OUT = 'test-output';
mkdirSync(OUT, { recursive: true });

const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✔' : '  ✘'} ${msg}`); if (!cond) failures++; };

const server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
console.log('Dev server:', url);

const browser = await chromium.launch({
  executablePath,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});

async function run(viewport, label, full) {
  console.log(`\n▶ ${label} (${viewport.width}x${viewport.height})`);
  const page = await browser.newPage({ viewport, hasTouch: !!viewport.touch, isMobile: !!viewport.touch });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__bubbleSub && window.__bubbleSub.state === 'start', null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${label}-0-start.png` });

  const G = (fn, arg) => page.evaluate(fn, arg);
  const tap = async (p) => { if (viewport.touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y); };
  const waitFor = (fn, arg, timeout = 40000) => page.waitForFunction(fn, arg, { timeout, polling: 100 });

  // start
  await tap({ x: viewport.width / 2, y: viewport.height / 2 });
  await waitFor(() => window.__bubbleSub.state === 'play');
  ok(true, 'play button starts the game');
  await page.waitForTimeout(500);
  ok((await G(() => window.__bubbleSub.hint())).startsWith('spot'), 'first-action hint points at a hiding place');
  await page.screenshot({ path: `${OUT}/${label}-1-hint.png` });
  await G(() => { window.__bubbleSub.timeScale = 3; });

  // ---- movement: tap open water, the sub glides there smoothly
  const goal = { x: -5, y: 3.2 };
  const p = await G(([x, y]) => window.__bubbleSub.screenOf(x, y), [goal.x, goal.y]);
  const before = await G(() => window.__bubbleSub.sub());
  await tap(p);
  const samples = [];
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(150); samples.push(await G(() => window.__bubbleSub.sub())); }
  await waitFor(([x, y]) => { const s = window.__bubbleSub.sub(); return Math.hypot(s.x - x, s.y - y) < 0.3 && s.speed < 0.2; }, [goal.x, goal.y]);
  const after = await G(() => window.__bubbleSub.sub());
  ok(Math.abs(after.tx - goal.x) < 0.3 && Math.abs(after.ty - goal.y) < 0.3, `tap sets target to tapped spot (${after.tx.toFixed(2)}, ${after.ty.toFixed(2)})`);
  ok(Math.hypot(after.x - before.x, after.y - before.y) > 5, `sub travelled ${Math.hypot(after.x - before.x, after.y - before.y).toFixed(1)} units and arrived`);
  ok(Math.max(...samples.map((s) => s.speed)) <= 3.45, `movement stays slow (max speed ${Math.max(...samples.map((s) => s.speed)).toFixed(2)} u/s)`);

  // tapping the floor clamps the target above the sand
  const floorTap = await G(() => window.__bubbleSub.screenOf(-8, -6));
  await tap({ x: floorTap.x, y: Math.min(floorTap.y, viewport.height - 5) });
  const ft = await G(() => window.__bubbleSub.sub());
  ok(ft.ty > -2.2, `seabed tap keeps the sub above the sand (target y ${ft.ty.toFixed(2)})`);
  await page.waitForTimeout(800);

  // ---- collection: tap each hiding place
  const spots = await G(() => window.__bubbleSub.spots());
  ok(spots.length === 5 && new Set(spots.map((s) => s.creature)).size === 5, 'five hiding places with five different friends');
  for (let i = 0; i < spots.length; i++) {
    const s = (await G(() => window.__bubbleSub.spots()))[i];
    await tap(s.screen);
    await waitFor((id) => window.__bubbleSub.creatures().find((c) => c.id === id).state === 'following', s.creature);
    const found = await page.$$eval('.portrait.found', (els) => els.length);
    ok(found === i + 1, `tapped ${s.type} → ${s.creature} pops out and follows (${found}/5 portraits coloured)`);
    if (i === 1) await page.screenshot({ path: `${OUT}/${label}-2-following.png` });
  }
  await page.waitForTimeout(1500);
  ok((await G(() => window.__bubbleSub.creatures())).every((c) => c.state === 'following'), 'all five friends swim behind the submarine');
  await page.screenshot({ path: `${OUT}/${label}-3-all-found.png` });

  // ---- party: bring them to the coral arch
  if (full) {
    // the hint now points at the arch once the child is idle
    await waitFor(() => window.__bubbleSub.hint() === 'arch', null, 20000).then(() => ok(true, 'idle hint points at the party arch'), () => ok(false, 'idle hint points at the party arch'));
  }
  await tap(await G(() => window.__bubbleSub.archScreen()));
  await waitFor(() => window.__bubbleSub.creatures().every((c) => c.state === 'home' || c.state === 'party'));
  ok((await page.$$eval('.portrait.home', (els) => els.length)) === 5, 'all five portraits marked as home');
  await waitFor(() => window.__bubbleSub.state === 'party');
  ok(true, 'returning everyone starts the dance party');
  const p0 = (await G(() => window.__bubbleSub.stats)).particles;
  await page.waitForTimeout(1500);
  ok((await G(() => window.__bubbleSub.stats)).particles - p0 > 30, 'bubble confetti is flying');
  await page.screenshot({ path: `${OUT}/${label}-4-party.png` });
  await page.waitForSelector('#replayBtn.show', { timeout: 20000 });
  ok(true, 'replay button appears after the dance');

  // ---- extras: pufferfish and shell instruments still work during play
  if (full) {
    const pf = await G(() => window.__bubbleSub.pufferScreen());
    await tap(pf);
    await waitFor(() => window.__bubbleSub.puffer().inflate > 0.6);
    ok(true, 'pufferfish inflates when tapped');
    await page.screenshot({ path: `${OUT}/${label}-5-puffer.png` });
    const ins = await G(() => window.__bubbleSub.instrumentScreens());
    for (const s of ins) await tap(s);
    ok((await G(() => window.__bubbleSub.stats)).notes === 5, 'all five shell instruments play');
  }

  // ---- replay rearranges the hiding places
  const layoutBefore = await G(() => window.__bubbleSub.layout);
  const box = await page.$eval('#replayBtn', (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await tap(box);
  await waitFor(() => window.__bubbleSub.state === 'play');
  const layoutAfter = await G(() => window.__bubbleSub.layout);
  const cs = await G(() => window.__bubbleSub.creatures());
  ok(cs.every((c) => c.state === 'hidden'), 'replay hides all friends again');
  ok((await page.$$eval('.portrait.found, .portrait.home', (els) => els.length)) === 0, 'replay resets the portraits');
  ok(layoutAfter !== layoutBefore, `replay rearranges hiding places (${layoutBefore} → ${layoutAfter})`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${label}-6-replay.png` });

  // ---- settings
  if (full) {
    await page.click('#soundBtn');
    ok((await page.getAttribute('#soundBtn', 'aria-pressed')) === 'false', 'mute button toggles sound off');
    await page.click('#calmBtn');
    ok((await G(() => window.__bubbleSub.settings.calm)) === true, 'calmer-effects toggle turns on');
    await page.reload();
    await page.waitForFunction(() => window.__bubbleSub);
    ok((await G(() => [window.__bubbleSub.settings.sound, window.__bubbleSub.settings.calm].join())) === 'false,true', 'settings persist across reloads');
  }

  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await page.close();
}

try {
  await run({ width: 1280, height: 720 }, 'desktop', true);
  await run({ width: 1024, height: 768, touch: true }, 'tablet', false);
  await run({ width: 390, height: 844, touch: true }, 'phone-portrait', false);
} catch (e) {
  console.error(e); failures++;
} finally {
  await browser.close();
  await server.close();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed ✔');
process.exit(failures ? 1 : 0);
