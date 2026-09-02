// None of your four source GLBs contain baked animation clips (verified —
// see the asset audit in README). This module fakes "clips" by tweening
// node transforms at runtime instead. It only works precisely where a node
// name actually exists to target (verified against your real GLBs — see
// lib/procedures/*.ts comments for which machines that's true for).
//
// Where no real named part exists (robotic-manipulator, electric-hydro-press
// — their nodes are anonymous Sketchfab exports like "Cylinder.004"), this
// falls back to a whole-model pulse: a brief scale/emissive flash on the
// entire object. That's honest feedback that "something happened" without
// pretending to show mechanism motion that isn't actually identifiable in
// the geometry.

export type Easing = (t: number) => number;

export const easeInOutCubic: Easing = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export interface NodeKeyframe {
  /** Case-insensitive substring to match against real scene node names. */
  targetNodeSubstring: string;
  property: "position" | "rotation";
  axis: "x" | "y" | "z";
  from: number;
  to: number;
}

export interface AnimationClipDef {
  id: string;
  durationMs: number;
  easing?: Easing;
  /** One or more nodes to animate. If NONE of these resolve to a real node
   * in the loaded scene, MachineViewer falls back to a whole-model pulse. */
  keyframes: NodeKeyframe[];
  /** Whether to play the keyframes forward then back to start (e.g. a press stroke). */
  pingPong?: boolean;
}

// Clip ids referenced by lib/procedures/*.ts `animationClip` fields.
export const ANIMATION_CLIPS: Record<string, AnimationClipDef> = {
  // --- Tensile/bending tester placeholder (real, verified node names —
  // this placeholder GLB was authored by this same codebase, see
  // scripts/build_placeholder_tensile_tester.py, so these names are exact) ---
  crosshead_descend: {
    id: "crosshead_descend",
    durationMs: 2200,
    easing: easeInOutCubic,
    pingPong: true,
    keyframes: [
      { targetNodeSubstring: "crosshead", property: "position", axis: "y", from: 0.42, to: 0.22 },
      { targetNodeSubstring: "upper_grip", property: "position", axis: "y", from: 0.39, to: 0.19 },
      { targetNodeSubstring: "load_cell", property: "position", axis: "y", from: 0.46, to: 0.26 },
    ],
  },

  // --- Milling machine (the ONE real, verified sub-assembly: the vice) ---
  vice_clamp: {
    id: "vice_clamp",
    durationMs: 900,
    easing: easeInOutCubic,
    keyframes: [
      { targetNodeSubstring: "moving jaw", property: "position", axis: "x", from: 0, to: -0.012 },
    ],
  },
  spindle_run: {
    id: "spindle_run",
    durationMs: 600,
    // No verified spindle/column node name exists in this file (see README) —
    // this clip intentionally has no keyframes, so MachineViewer will use the
    // whole-model pulse fallback rather than guess at a wrong node.
    keyframes: [],
  },

  // --- Robotic manipulator & hydraulic press: no nameable nodes exist
  // (verified — see README). These clips are deliberately empty so the
  // viewer's fallback pulse fires instead of a fabricated node target. ---
  home_sequence: { id: "home_sequence", durationMs: 1200, keyframes: [] },
  pick_place_cycle_slow: { id: "pick_place_cycle_slow", durationMs: 2500, keyframes: [] },
  pick_place_cycle: { id: "pick_place_cycle", durationMs: 1500, keyframes: [] },
  press_stroke: { id: "press_stroke", durationMs: 1200, pingPong: true, keyframes: [] },
};
