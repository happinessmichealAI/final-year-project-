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

The machines are procedural Three.js models rather than fragile anonymous CAD exports. This allows individual teaching components to be selectable and highlighted, while joints, workpieces and machine motions can be animated directly.

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
