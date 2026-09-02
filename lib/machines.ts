import { MachineProcedure } from "./procedures/types";
import { roboticManipulatorProcedure } from "./procedures/roboticManipulator";
import { verticalMillingMachineProcedure } from "./procedures/verticalMillingMachine";
import { electricHydroPressProcedure } from "./procedures/electricHydroPress";
import { tensileBendingTesterProcedure } from "./procedures/tensileBendingTester";

export type MachineStatus = "ready" | "needs_compression" | "blocked_no_model";

export interface MachineMeta {
  slug: string;
  name: string;
  modelPath: string | null;
  status: MachineStatus;
  statusNote: string;
  procedure: MachineProcedure | null;
}

// This is the honest state of the project as of the asset audit. Update
// modelPath/status as you complete each pipeline step (see README.md).
export const MACHINES: MachineMeta[] = [
  {
    slug: "robotic-manipulator",
    name: "Robotic Manipulator",
    modelPath: "/models/robotic_manipulator.glb",
    status: "ready",
    statusNote:
      "8-step procedure. Node names in this GLB are anonymous Sketchfab exports (no 'estop_button' etc. exists) — per-part highlighting/animation isn't possible without manual Blender relabeling, so steps use a whole-model pulse instead of a fabricated highlight.",
    procedure: roboticManipulatorProcedure,
  },
  {
    slug: "vertical-milling-machine",
    name: "Vertical Milling Machine",
    modelPath: "/models/vertical_milling_machine.glb",
    status: "ready",
    statusNote:
      "8-step procedure. The vice sub-assembly has real, verified node names (Vice Base/Fixed Jaw/Moving Jaw/Handle) with working highlight + clamp animation. The rest of the machine (spindle, column, table) has only mojibake-encoded SolidWorks names — no highlighting there.",
    procedure: verticalMillingMachineProcedure,
  },
  {
    slug: "electric-hydro-press",
    name: "Electric Hydraulic Press",
    modelPath: "/models/electric_hydro_press.glb",
    status: "ready",
    statusNote:
      "7-step procedure (OSHA-aligned two-hand-control practice, general knowledge — verify against your actual press's manual). Node names in this GLB are anonymous ('Object_2' etc.) — same highlighting limitation as the robotic manipulator.",
    procedure: electricHydroPressProcedure,
  },
  {
    slug: "workhorse-3d-printer",
    name: "Workhorse 3D Printer",
    modelPath: "/models/workhorse_3d_printer.glb",
    status: "needs_compression",
    statusNote:
      "Optimized 20.6MB -> 14.1MB (stripped unused UVs, downsized indices; see scripts/optimize_3d_printer.py) with no triangle-count reduction. Still heavy for low-end mobile — real polygon reduction needs gltf-transform/meshoptimizer, which needs network access this build environment didn't have.",
    procedure: null,
  },
  {
    slug: "tensile-bending-tester",
    name: "Tensile / Bending Test Machine",
    modelPath: "/models/tensile_bending_tester_placeholder.glb",
    status: "needs_compression",
    statusNote:
      "SCHEMATIC PLACEHOLDER, not your real CAD — built from primitives (see scripts/build_placeholder_tensile_tester.py) because the uploaded zip has only unassembled SolidWorks parts. Swap modelPath here once you have a real glTF export.",
    procedure: tensileBendingTesterProcedure,
  },
];

export function getMachine(slug: string): MachineMeta | undefined {
  return MACHINES.find((m) => m.slug === slug);
}
