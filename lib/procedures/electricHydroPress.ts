import { MachineProcedure } from "./types";

// IMPORTANT — verified against the actual GLB: this file has only 14 nodes,
// named "Object_2" through "Object_13" (generic Sketchfab export). No
// nameable ram/die/frame parts exist. highlightNodes is intentionally empty
// below — see the same note in roboticManipulator.ts for why, and what it'd
// take to fix (manual Blender labeling by someone who can see the geometry).
//
// Step content follows standard mechanical/hydraulic press safety practice
// (OSHA-aligned two-hand control use, point-of-operation guarding). This is
// general-knowledge-based, not sourced from a manual for this specific
// press — verify against your actual equipment documentation before using
// this for real student evaluation, especially tonnage/pressure limits
// which vary by machine and aren't represented here at all.

export const electricHydroPressProcedure: MachineProcedure = {
  machineSlug: "electric-hydro-press",
  title: "Electric Hydraulic Press — Startup & Press Cycle",
  steps: [
    {
      id: "ehp-01",
      order: 1,
      title: "Inspect ram, die area, and hydraulic lines",
      instruction:
        "Check the ram, die, and work area for obstructions, and inspect hydraulic lines for leaks or damage before energizing the press.",
      acceptedActions: ["inspect_press"],
      safetyCritical: true,
    },
    {
      id: "ehp-02",
      order: 2,
      title: "Confirm point-of-operation guarding",
      instruction:
        "Verify the guard or light curtain over the die area is in place and functional before power-up.",
      acceptedActions: ["check_guarding"],
      safetyCritical: true,
      commonErrors: {
        power_on: "You tried to power on before confirming point-of-operation guarding — that guard is what keeps hands out of the die during a stroke.",
      },
    },
    {
      id: "ehp-03",
      order: 3,
      title: "Power on the hydraulic unit",
      instruction: "Switch on the hydraulic power unit and wait for system pressure to build to operating range.",
      acceptedActions: ["power_on"],
    },
    {
      id: "ehp-04",
      order: 4,
      title: "Set working pressure and stroke limits",
      instruction:
        "Set the working pressure and upper/lower stroke limits appropriate for this job before loading the workpiece.",
      acceptedActions: ["set_pressure_limits"],
      commonErrors: {
        position_workpiece: "Set pressure and stroke limits before placing the workpiece — you don't want to discover the limits are wrong with material already in the die.",
      },
    },
    {
      id: "ehp-05",
      order: 5,
      title: "Position workpiece",
      instruction: "Place and align the workpiece on the die bed.",
      acceptedActions: ["position_workpiece"],
      safetyCritical: true,
    },
    {
      id: "ehp-06",
      order: 6,
      title: "Engage two-hand control and cycle the press",
      instruction:
        "Use the two-hand control to initiate the press stroke — this keeps both hands clear of the die during the stroke by design.",
      acceptedActions: ["cycle_press"],
      safetyCritical: true,
      commonErrors: {
        cycle_press_one_hand: "Single-hand or bypassed operation defeats the two-hand control's entire purpose. This is a stop-work safety violation.",
      },
      animationClip: "press_stroke",
    },
    {
      id: "ehp-07",
      order: 7,
      title: "Release pressure and remove the part",
      instruction: "Retract the ram fully, confirm pressure has released, then remove the finished part.",
      acceptedActions: ["release_and_remove"],
    },
  ],
};
