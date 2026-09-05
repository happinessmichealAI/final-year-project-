// The procedure engine is deliberately dumb and deterministic. It does not use
// the AI model to decide whether a student is right or wrong — it checks the
// student's action against an explicit, author-defined step list. The AI tutor
// (see app/api/tutor/route.ts) is only ever called AFTER the engine has already
// produced a verdict, to turn that verdict into natural-language coaching.
// This keeps assessment auditable: every "correct"/"incorrect" call in your
// evaluation data traces back to a rule you can point to in your methodology
// chapter, not to an LLM's opinion.

export type ActionId = string;

export interface ProcedureStep {
  id: string;
  order: number;
  title: string;
  /** Plain-language instruction shown to the student for this step. */
  instruction: string;
  /** The action id(s) that satisfy this step. Student action must match one of these. */
  acceptedActions: ActionId[];
  /**
   * Action ids that are plausible-but-wrong for THIS step — used to give
   * specific, targeted error feedback instead of a generic "incorrect".
   * Map of actionId -> human-readable reason it's wrong right now.
   */
  commonErrors?: Record<ActionId, string>;
  /** If true, performing this step out of order is a safety violation, not just a sequence error. */
  safetyCritical?: boolean;
    /**
   * If set, this step requires numeric parameter input rather than an action
   * button, and `evaluate` decides correctness using an explicit educational
   * engineering rule. The milling spindle-speed step is the current worked
   * numeric example; other controls are interactive but are not presented as
   * validated plant measurements.
   */
  paramInputs?: { key: string; label: string; unit?: string }[];
  /**
   * Evaluates submitted parameters against real engineering constraints.
   * Only present on steps that also set paramInputs. Kept deliberately
   * simple (closed-form formulas, not a physics engine) — the point is
   * that a wrong numeric choice is actually checked, not that this
   * simulates the machine's full physical behavior.
   */
  evaluate?: (params: Record<string, number>) => { result: StepResult; message: string };
}

export interface MachineProcedure {
  machineSlug: string;
  title: string;
  /** Steps MUST be attempted in this order unless step.allowAnyOrder is set elsewhere. */
  steps: ProcedureStep[];
}

export type StepResult = "correct" | "incorrect" | "safety_violation" | "out_of_order";

export interface LogEntry {
  timestamp: string;
  machineSlug: string;
  stepId: string;
  studentAction: ActionId;
  result: StepResult;
  attemptNumber: number;
  /** Anonymous per-browser-session id (crypto.randomUUID()), not real
   * authentication — see README on why full student auth is still open. */
  sessionId: string;
  /** Present only for parameterized (evaluate()-based) steps. */
  parameters?: Record<string, number>;
}
