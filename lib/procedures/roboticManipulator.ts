import { MachineProcedure } from "./types";

// IMPORTANT — verified against the actual GLB (see README asset audit):
// this file's 56 nodes are named things like "Cylinder.004", "Cube.003" —
// generic Sketchfab/FBX export names with zero semantic content. There is
// no "estop_button" or "controller_cabinet" node to target. An earlier
// version of this file guessed such names; those guesses never matched
// anything and were removed rather than left in place looking functional.
//
// highlightNodes is intentionally empty on every step below. MachineViewer
// falls back to a whole-model pulse on step completion instead of
// highlighting a specific (fabricated) part. To get real per-part
// highlighting here, someone needs to open this GLB in Blender, identify
// which mesh is which physical part, and rename the nodes — there's no way
// to do that correctly without visually inspecting the geometry, which this
// sandbox can't render.
//
// Step order/content follows standard industrial robotic-arm startup
// practice — verify against your specific manipulator's manual before
// using this for real student evaluation.

export const roboticManipulatorProcedure: MachineProcedure = {
  machineSlug: "robotic-manipulator",
  title: "Robotic Manipulator — Pick-and-Place Startup & Cycle",
  steps: [
    {
      id: "rm-01",
      order: 1,
      title: "Pre-operation inspection",
      instruction:
        "Visually inspect the workspace and manipulator for obstructions, loose cabling, or damage before applying power.",
      acceptedActions: ["inspect_workspace"],
      commonErrors: {
        power_on: "You powered on before inspecting the workspace. Inspect first, every time.",
      },
      safetyCritical: true,
    },
    {
      id: "rm-02",
      order: 2,
      title: "Confirm emergency stop is accessible and functional",
      instruction: "Locate the emergency stop and verify it engages before proceeding.",
      acceptedActions: ["check_estop"],
      commonErrors: {
        home_robot: "You tried to home the arm before confirming the e-stop works.",
      },
      safetyCritical: true,
    },
    {
      id: "rm-03",
      order: 3,
      title: "Power on the controller",
      instruction: "Switch on the controller cabinet and wait for the boot sequence to complete.",
      acceptedActions: ["power_on"],
    },
    {
      id: "rm-04",
      order: 4,
      title: "Home the manipulator",
      instruction: "Send the arm to its home/reference position before loading a program.",
      acceptedActions: ["home_robot"],
      commonErrors: {
        load_program:
          "The arm must reach home position before you load a program — its current position is unknown to the controller until it homes.",
      },
      animationClip: "home_sequence",
    },
    {
      id: "rm-05",
      order: 5,
      title: "Load the pick-and-place program",
      instruction: "Select and load the correct program for this task from the controller.",
      acceptedActions: ["load_program"],
    },
    {
      id: "rm-06",
      order: 6,
      title: "Clear the workspace and enable guarding",
      instruction:
        "Ensure the safety guarding (light curtain / fence interlock) is active and no one is inside the operating envelope.",
      acceptedActions: ["enable_guarding"],
      safetyCritical: true,
      commonErrors: {
        start_cycle:
          "You tried to start the cycle with guarding disabled. This is a stop-work safety violation, not a procedural slip.",
      },
    },
    {
      id: "rm-07",
      order: 7,
      title: "Dry-run at reduced speed",
      instruction:
        "Run one full cycle at reduced speed to confirm the taught path is correct before releasing to full-speed automatic operation.",
      acceptedActions: ["reduced_speed_run"],
      animationClip: "pick_place_cycle_slow",
    },
    {
      id: "rm-08",
      order: 8,
      title: "Start automatic cycle",
      instruction: "Switch to automatic mode and start the production cycle.",
      acceptedActions: ["start_cycle"],
      animationClip: "pick_place_cycle",
    },
  ],
};
