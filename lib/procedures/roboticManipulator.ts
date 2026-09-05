import { MachineProcedure } from "./types";

export const roboticManipulatorProcedure: MachineProcedure = {
  machineSlug: "robotic-manipulator",
  title: "Robotic Manipulator — Three-Workpiece Pick & Place",
  steps: [
    { id: "rm-01", order: 1, title: "Inspect the robot cell", instruction: "Check the robot envelope, workpieces, cables and surrounding area for obstructions before enabling motion.", acceptedActions: ["inspect_workspace"], safetyCritical: true },
    { id: "rm-02", order: 2, title: "Check emergency stop and guarding", instruction: "Confirm the emergency-stop control is accessible and the safety fence/gate is closed before motion is enabled.", acceptedActions: ["check_safety"], safetyCritical: true },
    { id: "rm-03", order: 3, title: "Power on the controller", instruction: "Power the robot controller and wait for the simulated ready state.", acceptedActions: ["power_on"] },
    { id: "rm-04", order: 4, title: "Home the manipulator", instruction: "Send the robot to its reference position so the controller has a known starting pose.", acceptedActions: ["home_robot"] },
    { id: "rm-05", order: 5, title: "Select a workpiece", instruction: "Choose one of the three workpieces in the cell: aluminium block, cylindrical pin or steel cube.", acceptedActions: ["select_workpiece"] },
    { id: "rm-06", order: 6, title: "Close the gripper and pick", instruction: "Move to the selected workpiece, close the two-finger gripper around it and lift it clear of the table.", acceptedActions: ["pick_workpiece"], safetyCritical: true },
    { id: "rm-07", order: 7, title: "Move to the target tray and place", instruction: "Move the held workpiece to the target tray, open the gripper and release it without entering an unsafe pose.", acceptedActions: ["place_workpiece"] },
    { id: "rm-08", order: 8, title: "Repeat for the remaining workpieces", instruction: "Run the same controlled pick-and-place sequence for the other two workpieces until all three are in the target tray.", acceptedActions: ["complete_three_piece_cycle"] },
  ],
};
