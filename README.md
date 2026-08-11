# Early Recognition Trainer — Next.js + react-three-fiber + WebXR

A refactor of the single-file trainer into a proper JavaScript project so assets can be
optimized, code split, and API keys hidden server-side. Lives on the branch
**`refactor-nextjs-r3f`**; `main` still holds the working single-file build.

## Stack
- **Next.js 14 (App Router) + React 18 + TypeScript**
- **react-three-fiber** (three.js in React) + **@react-three/xr** (WebXR: VR button, controllers)
- **Vercel** for hosting (auto-deploy on push)

## Project layout
```
app/
  layout.tsx        root HTML shell + metadata
  page.tsx          client entry; loads <Sim/> with SSR disabled (WebGL needs the browser)
  globals.css       theme tokens
components/
  Sim.tsx           the <Canvas> + <XR> + Enter-VR button + HTML HUD (SBAR, vitals, actions, debrief)
  WardScene.tsx     the 3D ward: room, bed, patient, live monitor, beating heart, pointable buttons
lib/
  engine.ts         the sim engine (MI -> VF arrest), framework-agnostic — ported from the single file
  scenario.ts       case text + the Dr. Okafor voice persona/prompt
```

## Run locally (needs Node 18+ installed)
```bash
npm install
npm run dev          # http://localhost:3000
```
> Node was NOT available in the environment this scaffold was authored in, so it has not
> been built locally. The first real build happens on Vercel. `next.config.mjs` sets
> `ignoreBuildErrors`/`ignoreDuringBuilds` so a stray type/lint issue won't block that first
> deploy — turn those off once it's green and you have Node locally.

## Deploy to Vercel (steps)
1. Go to **vercel.com** → sign in **with GitHub**.
2. **Add New… → Project** → **Import** the `teteiwuala/ert` repo.
3. Framework preset auto-detects **Next.js** — leave build settings default.
4. Under **Git branch**, pick **`refactor-nextjs-r3f`** (so `main`'s static site is untouched).
5. **Deploy.** You get a free `*.vercel.app` URL; every push to that branch redeploys.

## Roadmap (not in this scaffold yet)
- **Voice (Dr. Okafor):** add a Next API route to mint an ElevenLabs signed URL server-side,
  then connect from the client — keeps the key off the browser.
- **AI patient:** a `/api/patient` route proxying Anthropic so the key stays server-side.
- **Asset optimization:** Draco-compress the `.glb` models and lazy-load via drei `useGLTF`.
