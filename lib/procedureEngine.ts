import { create } from "zustand";
import { MachineProcedure, StepResult, LogEntry, ActionId } from "./procedures/types";

interface EngineState {
  procedure: MachineProcedure | null;
  currentStepIndex: number;
  attemptCounts: Record<string, number>;
  log: LogEntry[];
  lastResult: { result: StepResult; message: string } | null;
  completed: boolean;
  /** Anonymous per-browser-session id — NOT real authentication.
   * See README: real student auth (Supabase Auth) is still open work. This
   * exists so log rows aren't anonymous-and-unattributable, which was a
   * legitimate gap in the previous version. */
  sessionId: string | null;

  loadProcedure: (procedure: MachineProcedure) => void;
  /** Standard button-action dispatch — matches against acceptedActions/commonErrors. */
  dispatchAction: (actionId: ActionId) => void;
  /** For steps with `evaluate` defined (see types.ts) — checks numeric
   * parameters against real engineering constraints instead of matching an
   * action id. */
  dispatchParameters: (params: Record<string, number>) => void;
  reset: () => void;
}

function recordAndAdvance(
  get: () => EngineState,
  set: (partial: Partial<EngineState>) => void,
  studentAction: ActionId,
  result: StepResult,
  message: string,
  parameters?: Record<string, number>
) {
  const { procedure, currentStepIndex, attemptCounts, log, sessionId } = get();
  if (!procedure) return;
  const step = procedure.steps[currentStepIndex];
  if (!step) return;

  const attemptKey = step.id;
  const nextAttempt = (attemptCounts[attemptKey] ?? 0) + 1;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    machineSlug: procedure.machineSlug,
    stepId: step.id,
    studentAction,
    result,
    attemptNumber: nextAttempt,
    sessionId: sessionId ?? "unknown-session",
    parameters,
  };

  const isLastStep = currentStepIndex === procedure.steps.length - 1;

  set({
    attemptCounts: { ...attemptCounts, [attemptKey]: nextAttempt },
    log: [...log, entry],
    lastResult: { result, message },
    currentStepIndex: result === "correct" ? currentStepIndex + (isLastStep ? 0 : 1) : currentStepIndex,
    completed: result === "correct" && isLastStep,
  });

  void persistLogEntry(entry);
}

export const useProcedureEngine = create<EngineState>((set, get) => ({
  procedure: null,
  currentStepIndex: 0,
  attemptCounts: {},
  log: [],
  lastResult: null,
  completed: false,
  sessionId: null,

  loadProcedure: (procedure) =>
    set((s) => ({
      procedure,
      currentStepIndex: 0,
      attemptCounts: {},
      log: [],
      lastResult: null,
      completed: false,
      // Generate once per browser session, not per machine — so a student
      // switching machines mid-session still gets one consistent session id.
      sessionId: s.sessionId ?? (typeof crypto !== "undefined" ? crypto.randomUUID() : null),
    })),

  dispatchAction: (actionId) => {
    const { procedure, currentStepIndex, completed } = get();
    if (!procedure || completed) return;
    const step = procedure.steps[currentStepIndex];
    if (!step) return;

    let result: StepResult;
    let message: string;

    if (step.acceptedActions.includes(actionId)) {
      result = "correct";
      message = `Correct — ${step.title} complete.`;
    } else if (step.safetyCritical && step.commonErrors?.[actionId]) {
      result = "safety_violation";
      message = step.commonErrors[actionId];
    } else if (step.commonErrors?.[actionId]) {
      result = "out_of_order";
      message = step.commonErrors[actionId];
    } else {
      result = "incorrect";
      message = `That action doesn't apply to the current step: "${step.title}".`;
    }

    recordAndAdvance(get, set, actionId, result, message);
  },

  dispatchParameters: (params) => {
    const { procedure, currentStepIndex, completed } = get();
    if (!procedure || completed) return;
    const step = procedure.steps[currentStepIndex];
    if (!step || !step.evaluate) return;

    const { result, message } = step.evaluate(params);
    const actionLabel = `params:${JSON.stringify(params)}`;
    recordAndAdvance(get, set, actionLabel, result, message, params);
  },

  reset: () =>
    set({
      currentStepIndex: 0,
      attemptCounts: {},
      log: [],
      lastResult: null,
      completed: false,
    }),
}));

async function persistLogEntry(entry: LogEntry) {
  try {
    await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
  } catch {
    // Non-fatal — local `log` state in the store is still the source of
    // truth for the current session even if remote persistence fails.
  }
}
