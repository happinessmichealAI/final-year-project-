"use client";

import { useEffect, useRef, useState } from "react";
import { useProcedureEngine } from "@/lib/procedureEngine";

interface ChatLine {
  role: "tutor" | "system";
  text: string;
}

export default function TutorChat() {
  const { procedure, currentStepIndex, lastResult, log } = useProcedureEngine();
  const [lines, setLines] = useState<ChatLine[]>([
    { role: "tutor", text: "I'll coach you through each step. Pick an action on the right to begin." },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastLoggedCount = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  useEffect(() => {
    // Only react to NEW log entries, not re-renders.
    if (log.length === lastLoggedCount.current) return;
    lastLoggedCount.current = log.length;

    const latest = log[log.length - 1];
    const step = procedure?.steps.find((s) => s.id === latest.stepId);
    if (!step || !lastResult) return;

    setLoading(true);
    fetch("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        machineTitle: procedure?.title,
        stepTitle: step.title,
        stepInstruction: step.instruction,
        studentAction: latest.studentAction,
        result: latest.result,
        templateMessage: lastResult.message,
        safetyCritical: step.safetyCritical ?? false,
        // Only present for parameter-validated steps (currently: milling
        // spindle speed, tensile-tester crosshead speed) — gives the model
        // the actual numbers the rules engine used, so it can reference them
        // specifically instead of speaking in generalities.
        parameters: latest.parameters ?? null,
        attemptNumber: latest.attemptNumber,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        // Explicit fallback flag from the route (see app/api/tutor/route.ts)
        // — previously this fell through to displaying data.error as if it
        // were tutor coaching text, which would show a raw error string to a
        // student mid-session. Now a missing/failed AI call always shows the
        // rule-based verdict, clearly labelled as such, never a stack trace.
        if (data.fallback) {
          setLines((prev) => [
            ...prev,
            { role: "system", text: `AI tutor unavailable — rule-based verdict: ${lastResult.message}` },
          ]);
        } else {
          setLines((prev) => [...prev, { role: "tutor", text: data.feedback ?? lastResult.message }]);
        }
      })
      .catch(() => {
        setLines((prev) => [
          ...prev,
          { role: "system", text: `Tutor unavailable. Rule-based verdict: ${lastResult.message}` },
        ]);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-panelBorder readout uppercase tracking-wide">
        AI Tutor
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {lines.map((line, i) => (
          <div key={i} className="text-sm leading-relaxed">
            <span className={`readout ${line.role === "tutor" ? "text-cyan" : "text-inkDim"}`}>
              {line.role === "tutor" ? "TUTOR" : "SYSTEM"}
            </span>
            <p className="mt-1 text-ink">{line.text}</p>
          </div>
        ))}
        {loading && <div className="readout text-inkDim">tutor is typing…</div>}
      </div>
    </div>
  );
}
