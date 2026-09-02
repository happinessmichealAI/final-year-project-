"use client";

import { useEffect, useState } from "react";
import { MachineProcedure } from "@/lib/procedures/types";
import { useProcedureEngine } from "@/lib/procedureEngine";

const resultColor: Record<string, string> = {
  correct: "text-ok",
  incorrect: "text-fault",
  safety_violation: "text-fault",
  out_of_order: "text-amber",
};

export default function ProcedurePanel({ procedure }: { procedure: MachineProcedure }) {
  const { loadProcedure, currentStepIndex, dispatchAction, dispatchParameters, lastResult, completed, log } =
    useProcedureEngine();
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadProcedure(procedure);
  }, [procedure, loadProcedure]);

  const currentStep = procedure.steps[currentStepIndex];

  useEffect(() => {
    // Clear the input form when moving to a new step.
    setParamValues({});
  }, [currentStepIndex]);

  const choices = currentStep
    ? Array.from(
        new Set([
          ...currentStep.acceptedActions,
          ...Object.keys(currentStep.commonErrors ?? {}),
        ])
      )
    : [];

  const submitParams = () => {
    if (!currentStep?.paramInputs) return;
    const parsed: Record<string, number> = {};
    for (const input of currentStep.paramInputs) {
      parsed[input.key] = parseFloat(paramValues[input.key] ?? "");
    }
    dispatchParameters(parsed);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-panelBorder">
        <div className="readout uppercase tracking-wide">Procedure</div>
        <div className="text-sm font-medium mt-0.5">{procedure.title}</div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {procedure.steps.map((step, i) => {
          const state =
            i < currentStepIndex || completed ? "done" : i === currentStepIndex ? "active" : "pending";
          return (
            <div
              key={step.id}
              className={`px-4 py-3 border-b border-panelBorder flex gap-3 ${
                state === "active" ? "bg-panel" : ""
              }`}
            >
              <div
                className={`readout mt-0.5 w-5 shrink-0 ${
                  state === "done" ? "text-ok" : state === "active" ? "text-amber" : "text-inkDim"
                }`}
              >
                {step.order.toString().padStart(2, "0")}
              </div>
              <div className="flex-1">
                <div
                  className={`text-sm ${
                    state === "pending" ? "text-inkDim" : "text-ink"
                  } ${step.safetyCritical ? "font-medium" : ""}`}
                >
                  {step.title}
                  {step.safetyCritical && (
                    <span className="ml-2 readout text-fault align-middle">SAFETY</span>
                  )}
                  {step.evaluate && (
                    <span className="ml-2 readout text-cyan align-middle">CALCULATED</span>
                  )}
                </div>
                {state === "active" && (
                  <p className="text-xs text-inkDim mt-1 leading-relaxed">{step.instruction}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!completed && currentStep && currentStep.paramInputs && (
        <div className="border-t border-panelBorder p-4 space-y-2">
          <div className="readout uppercase tracking-wide mb-2">Enter parameters</div>
          {currentStep.paramInputs.map((input) => (
            <div key={input.key} className="flex items-center gap-2">
              <label className="text-xs text-inkDim flex-1">{input.label}</label>
              <input
                type="number"
                value={paramValues[input.key] ?? ""}
                onChange={(e) => setParamValues((prev) => ({ ...prev, [input.key]: e.target.value }))}
                className="w-24 bg-bg border border-panelBorder px-2 py-1 text-sm text-ink font-mono"
              />
              {input.unit && <span className="readout w-10">{input.unit}</span>}
            </div>
          ))}
          <button
            onClick={submitParams}
            className="w-full mt-2 px-3 py-2 text-sm bg-bg border border-panelBorder hover:border-cyan transition-colors"
          >
            Check
          </button>
        </div>
      )}

      {!completed && currentStep && !currentStep.paramInputs && (
        <div className="border-t border-panelBorder p-4 space-y-2">
          <div className="readout uppercase tracking-wide mb-2">Choose action</div>
          {choices.map((action) => (
            <button
              key={action}
              onClick={() => dispatchAction(action)}
              className="w-full text-left px-3 py-2 text-sm bg-bg border border-panelBorder hover:border-amber transition-colors"
            >
              {action.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      )}

      {lastResult && (
        <div className={`px-4 py-3 border-t border-panelBorder text-sm ${resultColor[lastResult.result]}`}>
          {lastResult.message}
        </div>
      )}

      {completed && (
        <div className="px-4 py-3 border-t border-panelBorder text-sm text-ok">
          Procedure complete. {log.filter((l) => l.result !== "correct").length} error(s) logged
          across the session.
        </div>
      )}
    </div>
  );
}
