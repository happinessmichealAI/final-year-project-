# Digital Twin Lab

AI-assisted Digital Twin learning environment for engineering machine
operation training — Next.js + Three.js + Supabase + Groq/Qwen 3 32B.

## What changed in this pass — fixes to the four incomplete items

I ran actual scripts and re-verified against your real files rather than
just editing text. Results, stated plainly:

**1. Milling machine and hydraulic press procedures.**
Expanded from 3-step stubs to 8-step and 7-step sequences
(`lib/procedures/verticalMillingMachine.ts`,
`lib/procedures/electricHydroPress.ts`). Still general machine-shop/press
safety practice, not sourced from a manual for your specific machines —
verify feeds/speeds and press tonnage limits against real documentation
before using with students.

**2. 3D printer and tensile tester.**
- Printer: has zero textures (verified: `images.length === 0`), so I wrote
  `scripts/optimize_3d_printer.py`, which strips the now-provably-unused
  UV channel and downgrades oversized index buffers — geometry itself
  untouched. Result, measured on disk: **20.57MB → 14.06MB**. Still heavy;
  real triangle reduction needs `gltf-transform`/meshoptimizer, which need
  network access this sandbox doesn't have. Not added to the machine list
  with a procedure yet — that's still open.
- Tensile tester: still no real CAD export exists (that's a genuine
  blocker — see below). I built a **schematic placeholder** from primitives
  (`scripts/build_placeholder_tensile_tester.py`) grounded in your actual
  CAD part list (NEMA 34 stepper, lead screw, S-type load cell, 3030
  extrusion frame, STM32 controller) so the app has 5/5 machines instead of
  4/5. It is explicitly labeled a placeholder everywhere in the code and UI
  — swap `modelPath` in `lib/machines.ts` the moment you have a real export.

**3. Animations.**
None of your four source GLBs contain baked clips — still true, verified
again this pass. Built `lib/animations.ts`: a runtime keyframe system that
tweens real node transforms directly, with an honest fallback (a whole-model
pulse) when no real named part exists to target. This only produces
precise, part-specific motion where I could verify a real node name exists
(the milling machine's vice, and the tensile-tester placeholder, which I
authored myself). For the robotic manipulator and hydraulic press, it's a
generic pulse — see item 4 for why.

**4. Node names.**
Actually parsed all three real GLBs' node lists (not re-guessed). Result:
robotic manipulator (56 nodes) and hydraulic press (14 nodes) have **zero**
semantically meaningful names — generic Sketchfab export artifacts like
`Cylinder.004`, `Object_7`. The milling machine has 319 nodes, of which
one real sub-assembly is cleanly named (`Vice Base`, `Fixed Jaw`,
`Moving Jaw`, `Handle`, `Turntable`, `Arm`, `Holder`, `Flange`) and the rest
are SolidWorks feature names mangled by a non-UTF8 export (`Chamfer2`,
garbled Cyrillic/Turkish text). I removed every fabricated node-name guess
from the previous version and wired real names in wherever they exist. This
is a genuine, unresolved limitation of the source assets, not something
fixable in code — the real fix is opening each GLB in Blender and manually
renaming key parts, which needs a human looking at the geometry.

## Honest status — still read this

Same caveat as before: I wrote/edited every file by hand with **no internet
access**, so `npm install`/`npm run build` have still not been run against
this version. The new scripts (`scripts/*.py`) were run and self-validated
in this sandbox — their *outputs* (the two GLBs and the size numbers above)
are real and verified — but the TypeScript/React changes have not been
compiled. Run `npm install && npm run build` first and fix whatever surfaces.

What's real and working (once built):
- All 5 machines have models in `public/models/`.
- 4 of 5 have complete procedures (printer's is still open — wasn't in
  scope for this pass; happy to write it next).
- Procedure engine: deterministic, rule-based, logs every attempt.
- Animation: genuinely working for the milling-machine vice and the
  tensile-tester placeholder; honest generic fallback everywhere else.
- AI tutor uses Groq with Qwen 3 32B by default. The Groq API key is server-side only; if Groq is unavailable, the client deliberately falls back to the deterministic rule-based verdict.

What's still open:
- Real CAD assembly + export for the tensile tester (needs SolidWorks/
  Blender access I don't have here).
- Real polygon reduction for the printer (needs network access for
  gltf-transform).
- Manual node relabeling in Blender for the robotic manipulator and
  hydraulic press, if you want real per-part highlighting on those two.
- No pre/post test or TAM survey UI (Chapter 3 evaluation instruments).
- No authentication / student accounts.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in GROQ_API_KEY, GROQ_MODEL (optional), and Supabase values
npm run dev
```

## Supabase setup

1. Create a free project at supabase.com.
2. In the SQL editor, run:
   ```sql
   create table task_logs (
     id bigint generated always as identity primary key,
     timestamp timestamptz not null,
     machine_slug text not null,
     step_id text not null,
     student_action text not null,
     result text not null,
     attempt_number int not null,
     session_id text
   );
   ```
3. Copy the Project URL and `service_role` key into `.env.local`. Use the
   service role key server-side only — it's already only referenced in
   `app/api/log/route.ts`, never in a client component.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Go to vercel.com → New Project → import the repo.
3. Add the three env vars from `.env.example` in Vercel's project settings
   (Environment Variables), for Production and Preview.
4. Deploy. Vercel builds and hosts the frontend and API routes together —
   no separate backend to manage.

## Remaining build order (roadmap)

1. **Fix whatever `npm run build` surfaces** on first run.
2. **Write the 3D printer's procedure** — model is in the app now, just needs
   a `lib/procedures/workhorse3dPrinter.ts` and a `machines.ts` entry, same
   pattern as the other four.
3. **Get a real tensile-tester export.** The uploaded zip is raw SolidWorks
   parts with no visible top assembly — needs SolidWorks (or FreeCAD reading
   the STEP files) plus a glTF export (SimLab, Blender's glTF exporter, or
   similar). Once you have a real GLB, swap it in for the placeholder in
   `lib/machines.ts` and re-verify node names the same way this pass did —
   don't assume the placeholder's node names carry over.
4. **Real polygon reduction for the printer**, once you have network access:
   ```bash
   npx @gltf-transform/cli optimize workhorse_3d_printer.glb workhorse_3d_printer.compressed.glb
   ```
   (No `--texture-compress` needed — this file has no textures.)
5. **Manual node relabeling in Blender** for the robotic manipulator and
   hydraulic press GLBs, if you want real per-part highlighting/animation on
   those two instead of the generic pulse fallback. Open each file, identify
   which mesh is which physical part, rename them, re-export, then update
   `highlightNodes`/`lib/animations.ts` to match.
6. **Build the evaluation UI** — pre/post knowledge test, TAM usability
   survey, and a scoring view reading `task_logs` from Supabase.
7. **Add lightweight auth** (Supabase Auth) so logs tie to individual students.
