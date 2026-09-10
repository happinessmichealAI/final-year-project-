import { MachineProcedure } from "./procedures/types";
import { roboticManipulatorProcedure } from "./procedures/roboticManipulator";
import { verticalMillingMachineProcedure } from "./procedures/verticalMillingMachine";
import { electricHydroPressProcedure } from "./procedures/electricHydroPress";
import { workhorse3dPrinterProcedure } from "./procedures/workhorse3dPrinter";

export interface MachinePart {
  id: string;
  name: string;
  function: string;
  relevance: string;
}

export interface MachineMeta {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  procedure: MachineProcedure;
  parts: MachinePart[];
  workpieces: string[];
}

export const MACHINES: MachineMeta[] = [
  {
    slug: "robotic-manipulator",
    name: "Robotic Manipulator",
    shortName: "ROBOT ARM",
    description: "Interactive pick-and-place cell: home the robot, enable guarding, select three different workpieces, pick them with the gripper and place them in the target tray.",
    procedure: roboticManipulatorProcedure,
    workpieces: ["Aluminium block", "Cylindrical pin", "Steel cube"],
    parts: [
      { id: "base", name: "Base", function: "Supports the robot and provides the first rotary joint.", relevance: "Fixed reference point for every arm motion — checked first during the safety inspection step." },
      { id: "j1", name: "Shoulder joint", function: "Rotates the upper arm around the base.", relevance: "Provides the swing motion used to reach every pick and place position around the cell." },
      { id: "upper", name: "Upper arm", function: "Moves the reach of the robot between shoulder and elbow.", relevance: "Its reach and angle set how far the gripper can travel toward the workpiece or tray." },
      { id: "j2", name: "Elbow joint", function: "Changes the angle between upper and forearm links.", relevance: "Bends to extend or shorten the arm's effective reach during approach and retreat." },
      { id: "forearm", name: "Forearm", function: "Carries the wrist and gripper toward the workpiece.", relevance: "Extends the wrist and gripper the final distance to the workpiece." },
      { id: "wrist", name: "Wrist", function: "Orients the end effector.", relevance: "Fine orientation adjustment immediately before the gripper closes on the workpiece." },
      { id: "gripper", name: "Two-finger gripper", function: "Opens and closes around a workpiece.", relevance: "Must be correctly positioned and closed around the workpiece before lifting — this is the actual pick action the procedure checks for." },
      { id: "controller", name: "Robot controller", function: "Runs the taught motion program and safety logic.", relevance: "Runs the taught sequence; verified as part of the safety-check step before any motion is allowed." },
      { id: "fence", name: "Safety fence / gate", function: "Keeps people outside the robot operating envelope.", relevance: "Must be confirmed closed during the safety-check step before power-on is permitted." },
    ],
  },
  {
    slug: "vertical-milling-machine",
    name: "Vertical Milling Machine",
    shortName: "VERTICAL MILL",
    description: "Interactive milling setup: mount a workpiece in the vice, install the cutter, set speed/feed/depth, run the spindle and make a visible table-feed cutting pass.",
    procedure: verticalMillingMachineProcedure,
    workpieces: ["Mild-steel block", "Aluminium block", "Brass block"],
    parts: [
      { id: "base", name: "Machine base", function: "Supports the column and absorbs cutting loads.", relevance: "Absorbs cutting reaction forces — inspected before any setup begins." },
      { id: "column", name: "Column", function: "Carries the head and provides vertical structural support.", relevance: "Structural path between base and head; deflection here would affect cut accuracy." },
      { id: "head", name: "Milling head", function: "Contains the spindle drive and quill mechanism.", relevance: "Houses the spindle drive — its condition is part of the initial machine inspection." },
      { id: "spindle", name: "Spindle", function: "Rotates the cutting tool.", relevance: "Must be running before the feed step is accepted — checked directly by the procedure engine." },
      { id: "quill", name: "Quill", function: "Moves the spindle/tool vertically for depth control.", relevance: "Its vertical travel is what actually feeds the cutter into the workpiece." },
      { id: "table", name: "Machine table", function: "Supports and feeds the workholding fixture.", relevance: "Feeds the workpiece into the rotating cutter; motion is blocked until spindle speed and cut settings are both set." },
      { id: "vice", name: "Machine vice", function: "Clamps the workpiece during cutting.", relevance: "Must show the workpiece clamped before the tool-mounting step is accepted." },
      { id: "fixed-jaw", name: "Fixed jaw", function: "Provides the reference face for workpiece positioning.", relevance: "Reference face the workpiece is pushed against before clamping." },
      { id: "moving-jaw", name: "Moving jaw", function: "Clamps the workpiece against the fixed jaw.", relevance: "Its closing motion is what the 'clamp workpiece' step actually verifies." },
      { id: "handle", name: "Vice handle", function: "Turns the screw to open or close the moving jaw.", relevance: "The manual input that closes the moving jaw — turning it is the physical action behind 'clamp workpiece.'" },
      { id: "cutter", name: "End mill", function: "Removes material from the workpiece.", relevance: "Must be confirmed mounted before spindle start is allowed; its diameter feeds directly into the cutting-speed calculation." },
    ],
  },
  {
    slug: "electric-hydro-press",
    name: "Electric Hydraulic Press",
    shortName: "HYDRAULIC PRESS",
    description: "Interactive press cycle: inspect the frame, set pressure/stroke, align different workpieces, use the two-hand controls and observe the ram pressing operation.",
    procedure: electricHydroPressProcedure,
    workpieces: ["Flat sheet", "U-channel sample", "Small cylindrical slug"],
    parts: [
      { id: "frame", name: "Press frame", function: "Carries the cylinder, bed and reaction forces.", relevance: "Carries all reaction force from the ram stroke — inspected first." },
      { id: "cylinder", name: "Hydraulic cylinder", function: "Converts hydraulic pressure into ram motion.", relevance: "Converts the power unit's pressure into the ram's downward force." },
      { id: "ram", name: "Ram", function: "Moves downward to apply force to the workpiece.", relevance: "Its stroke is the actual pressing action — gated on two-hand activation and a mounted workpiece." },
      { id: "upper-die", name: "Upper die / punch", function: "Contacts the workpiece during forming or pressing.", relevance: "Point of contact with the workpiece; its shape determines the pressing result." },
      { id: "bed", name: "Die bed", function: "Supports the lower tooling and workpiece.", relevance: "Supports the lower tooling; alignment here is checked before the cycle is allowed." },
      { id: "lower-die", name: "Lower die", function: "Supports or shapes the workpiece during the stroke.", relevance: "Shapes or supports the workpiece opposite the punch during the stroke." },
      { id: "power-unit", name: "Hydraulic power unit", function: "Supplies pressurized hydraulic fluid.", relevance: "Must be powered on before the guard-check and alignment steps are accepted." },
      { id: "gauge", name: "Pressure gauge", function: "Displays the simulated hydraulic pressure.", relevance: "Shows the pressure driving the ram — a real check before running the cycle." },
      { id: "left-button", name: "Left two-hand button", function: "One input of the two-hand cycle command.", relevance: "Two-hand entry, together with the right button, is the actual interlock the procedure checks before the ram is allowed to move — either one alone is rejected." },
      { id: "right-button", name: "Right two-hand button", function: "Second input of the two-hand cycle command.", relevance: "Two-hand entry, together with the left button, is the actual interlock the procedure checks before the ram is allowed to move — either one alone is rejected." },
      { id: "guard", name: "Point-of-operation guard", function: "Separates the operator from the die space.", relevance: "Must be closed before power-on; part of the point-of-operation safety chain." },
    ],
  },
  {
    slug: "workhorse-3d-printer",
    name: "Workhorse 3D Printer",
    shortName: "3D PRINTER",
    description: "Illustrated FDM printer: load filament, home the axes, heat the hotend, start a print and watch the toolhead trace layers onto the build plate.",
    procedure: workhorse3dPrinterProcedure,
    workpieces: ["Calibration cube", "Gear", "Bracket"],
    parts: [
      { id: "frame", name: "Frame", function: "Rigid structure that keeps the printer axes aligned.", relevance: "Keeps X/Y/Z motion aligned; inspected before filament loading." },
      { id: "bed", name: "Build plate", function: "Supports the printed part during layer deposition.", relevance: "Print adhesion surface; verified before axis homing is accepted." },
      { id: "x-axis", name: "X-axis rail", function: "Guides left/right toolhead motion.", relevance: "Rail the carriage rides during left/right motion — its accuracy sets print quality on that axis." },
      { id: "y-axis", name: "Y-axis motion", function: "Moves the build platform/front-to-back.", relevance: "Front-to-back motion, checked as part of the homing sequence before heating is allowed." },
      { id: "z-axis", name: "Z-axis lead screws", function: "Moves the gantry/toolhead vertically.", relevance: "Steps the gantry up by one layer height after each pass." },
      { id: "carriage", name: "Print carriage", function: "Carries the hotend along the X-axis.", relevance: "Carries the hotend along the X-axis during the actual printing motion." },
      { id: "hotend", name: "Hotend / nozzle", function: "Heats and deposits molten filament.", relevance: "Must reach 205°C before a job can be loaded — the procedure checks this exact threshold." },
      { id: "extruder", name: "Extruder", function: "Feeds filament into the hotend.", relevance: "Feeds filament into the hotend; loading it is the first gated step." },
      { id: "spool", name: "Filament spool", function: "Stores the polymer feed material.", relevance: "Filament source — its loaded/not-loaded status gates every later step." },
      { id: "display", name: "Control display", function: "Selects jobs and shows printer status.", relevance: "Where job selection is confirmed before print start." },
    ],
  },
];

export function getMachine(slug: string): MachineMeta | undefined {
  return MACHINES.find((machine) => machine.slug === slug);
}
