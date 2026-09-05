import { MachineProcedure } from "./types";

export const workhorse3dPrinterProcedure: MachineProcedure = {
  machineSlug: "workhorse-3d-printer",
  title: "Workhorse 3D Printer — Setup & Print Cycle",
  steps: [
    { id: "3dp-01", order: 1, title: "Inspect the printer and build plate", instruction: "Check the frame, bed, nozzle area and filament path for obstructions before powering the printer.", acceptedActions: ["inspect_printer"], safetyCritical: true },
    { id: "3dp-02", order: 2, title: "Load the filament", instruction: "Route the selected filament through the spool holder and extruder path until it reaches the hotend inlet.", acceptedActions: ["load_filament"] },
    { id: "3dp-03", order: 3, title: "Home the printer axes", instruction: "Run the homing routine so X, Y and Z establish their reference positions before printing.", acceptedActions: ["home_axes"], safetyCritical: true },
    { id: "3dp-04", order: 4, title: "Heat the hotend and bed", instruction: "Select the material profile and wait for the simulated hotend and bed temperatures to reach their target state.", acceptedActions: ["heat_printer"] },
    { id: "3dp-05", order: 5, title: "Load the print job", instruction: "Choose one of the available educational workpieces and load its print path.", acceptedActions: ["load_job"] },
    { id: "3dp-06", order: 6, title: "Start the print", instruction: "Start the print and watch the nozzle trace the first layers. Keep the build area clear while the machine is moving.", acceptedActions: ["start_print"], safetyCritical: true },
    { id: "3dp-07", order: 7, title: "Monitor layer progress", instruction: "Observe the layer counter, nozzle path and deposited material until the print reaches completion.", acceptedActions: ["monitor_print"] },
    { id: "3dp-08", order: 8, title: "Stop heating and remove the part", instruction: "Finish the print, allow the simulated hotend to cool, then remove the printed workpiece from the build plate.", acceptedActions: ["finish_print"] },
  ],
};
