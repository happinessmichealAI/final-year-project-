# Final Year Project — Interactive Machine Skills Lab

A browser-based mechanical-engineering training environment built around four interactive digital-twin teaching machines. This revision is designed as a **machine-operation learning system**, not a passive CAD viewer.

## Machines

- **Robotic Manipulator** — safety check, controller power, homing, three different workpieces, gripper pick, transfer and placement into a target tray.
- **Vertical Milling Machine** — workpiece selection, vice clamping, cutter installation, spindle-speed calculation, feed/depth validation, visible cutting pass and release.
- **Electric Hydraulic Press** — guarding, hydraulic power, pressure/stroke validation, workpiece alignment, two-hand cycle, ram descent/retraction and workpiece forming.
- **Workhorse 3D Printer** — filament loading, X/Y/Z homing state, gradual heating, job selection, shape-specific toolpath and layer-by-layer printing.

The tensile/bending test machine has been removed from the project.

## Training architecture

Each machine page has two persistent areas:

1. **Machine/workplace section at the top.** It remains sticky while the student scrolls through the lower section. The 3D machine, workpieces and operation animation never get covered by controls or the tutor.
2. **Learning/control section below.** It contains the guided procedure, machine controls, workpiece selection, named parts/functions, live state, assessment summary and tutor.

## Operation and interlocks

The student cannot bypass the intended training sequence. Controls are disabled or blocked when a required setup condition has not been completed. Examples:

- Robot motion requires safety confirmation, controller power and homing.
- Milling feed requires a clamped workpiece, secured cutter, verified spindle speed and validated feed/depth settings.
- Hydraulic pressing requires power, closed guarding, validated pressure/stroke, workpiece alignment and both two-hand inputs.
- Printing requires filament, homing, target temperatures and a loaded job before motion begins.

The procedure engine remains deterministic. The AI tutor explains the engine's verdict; it does not decide whether an operation is correct.

## 3D teaching models

All four machines now use real 3D-scanned models for their static bodies (see Credits). Each machine's moving part — the robot's arm, the mill's cutter/vice, the press's ram/die, the printer's carriage — is still driven by our own animated, clickable system, since none of the source models include a rig; a static scan can't animate on its own.

## Credits

3D models used for the static machine bodies, all licensed **CC-BY-4.0** (http://creativecommons.org/licenses/by/4.0/), sourced from Sketchfab:
- Robotic Manipulator — **Makke** — https://sketchfab.com/3d-models/robotic-manipulator-0fd88ae6662745c9a73e28afc9991be4
- Electric Hydro Press — **bluoppVR** — https://sketchfab.com/3d-models/electric-hydro-press-8f4bd0b60353408d8b598a1de458f4b0
- Vertical Milling Machine — **vramstudio** — https://sketchfab.com/3d-models/vertical-milling-machine-0e7444ee28aa4150b60b966179085f55
- Workhorse 3D Printer — **3D Distributed** — https://sketchfab.com/3d-models/workhorse-3d-printer-74a15c93277c4a8485bdd0fa8da8550b

## Assessment/session record

The browser keeps an anonymous session ID and the local UI records attempts, correct actions, safety violations and completion. Supabase persistence is supported through `/api/log` when environment variables are configured.

For a production student-assessment deployment, add **Supabase Auth + Row Level Security** so the student's identity is verified and log rows cannot be fabricated by an unauthenticated caller. The current anonymous session ID is not authentication and must not be described as tamper-proof assessment data.

## AI tutor

Set `GROQ_API_KEY` in Vercel for AI coaching. The API route receives the deterministic procedure verdict and turns it into short contextual feedback. If the external model is unavailable, the local tutor and procedure engine continue to work.

## Development

```bash
npm install
npm run build
npm run start
```

This repository was statically checked in the provided environment using TypeScript's TS/TSX transpiler. A full `next build` still requires dependency installation and a network-enabled Node environment.
