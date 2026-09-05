import { MachineProcedure } from "./procedures/types";
import { roboticManipulatorProcedure } from "./procedures/roboticManipulator";
import { verticalMillingMachineProcedure } from "./procedures/verticalMillingMachine";
import { electricHydroPressProcedure } from "./procedures/electricHydroPress";
import { workhorse3dPrinterProcedure } from "./procedures/workhorse3dPrinter";

export interface MachinePart {
  id: string;
  name: string;
  function: string;
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
      { id: "base", name: "Base", function: "Supports the robot and provides the first rotary joint." },
      { id: "j1", name: "Shoulder joint", function: "Rotates the upper arm around the base." },
      { id: "upper", name: "Upper arm", function: "Moves the reach of the robot between shoulder and elbow." },
      { id: "j2", name: "Elbow joint", function: "Changes the angle between upper and forearm links." },
      { id: "forearm", name: "Forearm", function: "Carries the wrist and gripper toward the workpiece." },
      { id: "wrist", name: "Wrist", function: "Orients the end effector." },
      { id: "gripper", name: "Two-finger gripper", function: "Opens and closes around a workpiece." },
      { id: "controller", name: "Robot controller", function: "Runs the taught motion program and safety logic." },
      { id: "fence", name: "Safety fence / gate", function: "Keeps people outside the robot operating envelope." },
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
      { id: "base", name: "Machine base", function: "Supports the column and absorbs cutting loads." },
      { id: "column", name: "Column", function: "Carries the head and provides vertical structural support." },
      { id: "head", name: "Milling head", function: "Contains the spindle drive and quill mechanism." },
      { id: "spindle", name: "Spindle", function: "Rotates the cutting tool." },
      { id: "quill", name: "Quill", function: "Moves the spindle/tool vertically for depth control." },
      { id: "table", name: "Machine table", function: "Supports and feeds the workholding fixture." },
      { id: "vice", name: "Machine vice", function: "Clamps the workpiece during cutting." },
      { id: "fixed-jaw", name: "Fixed jaw", function: "Provides the reference face for workpiece positioning." },
      { id: "moving-jaw", name: "Moving jaw", function: "Clamps the workpiece against the fixed jaw." },
      { id: "handle", name: "Vice handle", function: "Turns the screw to open or close the moving jaw." },
      { id: "cutter", name: "End mill", function: "Removes material from the workpiece." },
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
      { id: "frame", name: "Press frame", function: "Carries the cylinder, bed and reaction forces." },
      { id: "cylinder", name: "Hydraulic cylinder", function: "Converts hydraulic pressure into ram motion." },
      { id: "ram", name: "Ram", function: "Moves downward to apply force to the workpiece." },
      { id: "upper-die", name: "Upper die / punch", function: "Contacts the workpiece during forming or pressing." },
      { id: "bed", name: "Die bed", function: "Supports the lower tooling and workpiece." },
      { id: "lower-die", name: "Lower die", function: "Supports or shapes the workpiece during the stroke." },
      { id: "power-unit", name: "Hydraulic power unit", function: "Supplies pressurized hydraulic fluid." },
      { id: "gauge", name: "Pressure gauge", function: "Displays the simulated hydraulic pressure." },
      { id: "left-button", name: "Left two-hand button", function: "One input of the two-hand cycle command." },
      { id: "right-button", name: "Right two-hand button", function: "Second input of the two-hand cycle command." },
      { id: "guard", name: "Point-of-operation guard", function: "Separates the operator from the die space." },
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
      { id: "frame", name: "Frame", function: "Rigid structure that keeps the printer axes aligned." },
      { id: "bed", name: "Build plate", function: "Supports the printed part during layer deposition." },
      { id: "x-axis", name: "X-axis rail", function: "Guides left/right toolhead motion." },
      { id: "y-axis", name: "Y-axis motion", function: "Moves the build platform/front-to-back." },
      { id: "z-axis", name: "Z-axis lead screws", function: "Moves the gantry/toolhead vertically." },
      { id: "carriage", name: "Print carriage", function: "Carries the hotend along the X-axis." },
      { id: "hotend", name: "Hotend / nozzle", function: "Heats and deposits molten filament." },
      { id: "extruder", name: "Extruder", function: "Feeds filament into the hotend." },
      { id: "spool", name: "Filament spool", function: "Stores the polymer feed material." },
      { id: "display", name: "Control display", function: "Selects jobs and shows printer status." },
    ],
  },
];

export function getMachine(slug: string): MachineMeta | undefined {
  return MACHINES.find((machine) => machine.slug === slug);
}
