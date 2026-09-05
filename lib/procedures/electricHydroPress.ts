import { MachineProcedure } from "./types";

export const electricHydroPressProcedure: MachineProcedure = {
  machineSlug: "electric-hydro-press",
  title: "Electric Hydraulic Press — Setup & Two-Hand Press Cycle",
  steps: [
    { id: "ehp-01", order: 1, title: "Inspect the frame, ram, tooling and hoses", instruction: "Check the press structure, hydraulic lines, ram and die area for damage, leaks or obstructions.", acceptedActions: ["inspect_press"], safetyCritical: true },
    { id: "ehp-02", order: 2, title: "Confirm point-of-operation guarding", instruction: "Verify the guard is closed and the die space is protected before energizing the press.", acceptedActions: ["check_guarding"], safetyCritical: true },
    { id: "ehp-03", order: 3, title: "Power on the hydraulic unit", instruction: "Start the hydraulic power unit and confirm the simulated pressure system is ready.", acceptedActions: ["power_on"] },
    { id: "ehp-04", order: 4, title: "Set pressure and stroke limits", instruction: "Choose moderate pressure and stroke settings for the selected workpiece before loading it. The simulator checks the training limits before allowing the cycle.", acceptedActions: ["set_pressure_limits"], paramInputs: [{ key: "pressure", label: "Pressure", unit: "%" }, { key: "stroke", label: "Stroke", unit: "mm" }], evaluate: (params) => { const p=params.pressure, s=params.stroke; if (!(p > 0) || !(s > 0)) return { result: "incorrect", message: "Pressure and stroke must both be positive." }; if (p < 25 || p > 80 || s < 10 || s > 55) return { result: "safety_violation", message: "Use the defined educational limits: pressure 25–80% and stroke 10–55 mm." }; return { result: "correct", message: `Press settings accepted: ${p.toFixed(0)}% pressure and ${s.toFixed(0)} mm stroke.` }; } },
    { id: "ehp-05", order: 5, title: "Align the workpiece on the die bed", instruction: "Select a workpiece, place it centrally on the lower die and confirm alignment before the stroke.", acceptedActions: ["position_workpiece"], safetyCritical: true },
    { id: "ehp-06", order: 6, title: "Use both controls to start the press stroke", instruction: "Press and hold the left and right two-hand controls together to command the ram downward.", acceptedActions: ["cycle_press"], safetyCritical: true },
    { id: "ehp-07", order: 7, title: "Release pressure and remove the part", instruction: "Allow the ram to retract fully, confirm the simulated pressure has released, then remove the pressed workpiece.", acceptedActions: ["release_and_remove"] },
  ],
};
