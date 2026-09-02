import { MachineProcedure } from "./types";

// Verified against the actual GLB (319 nodes). Two findings that matter:
//
// 1. There IS one real, nameable sub-assembly: a "2-Way Angle Vice Assem"
//    with cleanly-named child parts — "Vice Base", "Fixed Jaw",
//    "Moving Jaw", "Handle", "Turntable", "Arm", "Holder", "Flange". The
//    secure_workpiece step below uses these for real, and vice_clamp in
//    lib/animations.ts genuinely animates the "Moving Jaw" node.
//
// 2. Everything else — spindle head, column, table, quill, motor housing —
//    only exists under SolidWorks feature-tree names that got mangled to
//    non-UTF8 mojibake on export (things like "��������1", presumably
//    Cyrillic or Turkish in the original). There is no usable "spindle_head"
//    or "table" node string to target. Steps below that would naturally
//    highlight those parts have empty highlightNodes for that reason — not
//    an oversight, a verified absence. Fixing this requires re-exporting
//    from SolidWorks with correct encoding, or manual Blender relabeling by
//    someone who can see the geometry.
//
// Step content is standard vertical-mill startup/operating practice
// (workholding -> spindle speed selection -> cut) — general knowledge, not
// sourced from a manual for this specific machine. Verify feeds/speeds
// guidance against your actual equipment and material before real student use.
//
// vmm-04 (spindle speed) is this project's one worked example of REAL
// parameter-validated error detection — the student enters cutter diameter
// and RPM, and it's checked against the cutting-speed formula (Vc = πDN/1000)
// for HSS-on-mild-steel, not just accepted because a button was clicked. This
// is deliberately the only step built this way for now — extending every
// step on every machine to this depth is a multi-week undertaking (real
// engineering models per material/tool/machine), not a same-day fix. Treat
// this step as the pattern to replicate elsewhere if you have time before
// your defense, not as "done everywhere."

export const verticalMillingMachineProcedure: MachineProcedure = {
  machineSlug: "vertical-milling-machine",
  title: "Vertical Milling Machine — Setup & First Cut",
  steps: [
    {
      id: "vmm-01",
      order: 1,
      title: "Inspect machine and clear the table",
      instruction: "Check the table, spindle, and surrounding area are clear before starting setup.",
      acceptedActions: ["inspect_machine"],
      safetyCritical: true,
    },
    {
      id: "vmm-02",
      order: 2,
      title: "Secure workpiece in the vice",
      instruction:
        "Open the vice, place the workpiece against the fixed jaw, and turn the handle to clamp it via the moving jaw. Verify it's fully seated before proceeding.",
      acceptedActions: ["secure_workpiece"],
      safetyCritical: true,
      commonErrors: {
        start_spindle: "You tried to start the spindle before the workpiece was clamped in the vice.",
      },
      highlightNodes: ["Vice Base", "Fixed Jaw", "Moving Jaw", "Handle"],
      animationClip: "vice_clamp",
    },
    {
      id: "vmm-03",
      order: 3,
      title: "Mount and secure the cutting tool",
      instruction: "Insert the correct cutter into the tool holder and tighten it securely.",
      acceptedActions: ["mount_tool"],
      safetyCritical: true,
    },
    {
      id: "vmm-04",
      order: 4,
      title: "Set spindle speed for the tool and material",
      instruction:
        "Enter the cutter diameter and the spindle speed (RPM) you'd set. This is checked against the cutting-speed relationship for HSS-on-mild-steel, not just accepted as clicked.",
      acceptedActions: ["set_spindle_speed"],
      paramInputs: [
        { key: "diameterMm", label: "Cutter diameter", unit: "mm" },
        { key: "rpm", label: "Spindle speed", unit: "RPM" },
      ],
      evaluate: (params) => {
        const { diameterMm, rpm } = params;
        if (!diameterMm || diameterMm <= 0) {
          return { result: "incorrect", message: "Cutter diameter must be a positive number." };
        }
        if (!rpm || rpm <= 0) {
          return { result: "incorrect", message: "Spindle speed must be a positive number." };
        }
        // Cutting speed from RPM: Vc = (pi * D * N) / 1000, D in mm, N in RPM, Vc in m/min.
        const vc = (Math.PI * diameterMm * rpm) / 1000;
        // HSS cutter on mild steel: textbook recommended range is roughly
        // 20-35 m/min (conservative general-purpose milling range — verify
        // against your actual tooling manufacturer's data before using this
        // for real student evaluation; this single range is the whole
        // "engineering model" here, deliberately simple by design, not a
        // claim of comprehensive machinability coverage).
        const VC_MIN = 20;
        const VC_MAX = 35;
        if (vc < VC_MIN) {
          return {
            result: "incorrect",
            message: `That RPM gives a cutting speed of ${vc.toFixed(1)} m/min — too slow for HSS on mild steel (target ${VC_MIN}-${VC_MAX} m/min). You're wasting time and risking built-up edge. Increase RPM or use a larger-diameter cutter.`,
          };
        }
        if (vc > VC_MAX) {
          return {
            result: "safety_violation",
            message: `That RPM gives a cutting speed of ${vc.toFixed(1)} m/min — too fast for HSS on mild steel (target ${VC_MIN}-${VC_MAX} m/min). This risks rapid tool wear or breakage. Reduce RPM.`,
          };
        }
        return {
          result: "correct",
          message: `Cutting speed = ${vc.toFixed(1)} m/min — within the HSS/mild-steel range. Good selection.`,
        };
      },
    },
    {
      id: "vmm-05",
      order: 5,
      title: "Start the spindle",
      instruction: "Engage the spindle and confirm stable rotation before advancing the cutter into the workpiece.",
      acceptedActions: ["start_spindle"],
      animationClip: "spindle_run",
    },
    {
      id: "vmm-06",
      order: 6,
      title: "Set depth of cut and feed",
      instruction: "Set an appropriate depth of cut and feed rate for the first pass.",
      acceptedActions: ["set_feed_depth"],
      commonErrors: {
        engage_feed: "You tried to engage the feed before setting depth of cut — that's an uncontrolled first pass.",
      },
    },
    {
      id: "vmm-07",
      order: 7,
      title: "Engage feed and make the pass",
      instruction: "Engage the table feed and make the first cutting pass, watching chip formation.",
      acceptedActions: ["engage_feed"],
    },
    {
      id: "vmm-08",
      order: 8,
      title: "Retract, stop spindle, and release workpiece",
      instruction: "Retract the cutter, stop the spindle, then loosen the vice handle to release the finished part.",
      acceptedActions: ["retract_and_release"],
      highlightNodes: ["Handle", "Moving Jaw"],
    },
  ],
};
