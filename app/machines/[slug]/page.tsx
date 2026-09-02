"use client";

import { useMemo } from "react";
import { notFound, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { getMachine } from "@/lib/machines";
import ProcedurePanel from "@/components/ProcedurePanel";
import TutorChat from "@/components/TutorChat";
import { useProcedureEngine } from "@/lib/procedureEngine";

// MachineViewer uses three.js canvas APIs that don't exist server-side.
const MachineViewer = dynamic(() => import("@/components/MachineViewer"), { ssr: false });

export default function MachinePage() {
  const params = useParams<{ slug: string }>();
  const machine = getMachine(params.slug);
  const currentStepIndex = useProcedureEngine((s) => s.currentStepIndex);
  const procedure = useProcedureEngine((s) => s.procedure);

  const highlightNodes = useMemo(() => {
    if (!procedure) return [];
    return procedure.steps[currentStepIndex]?.highlightNodes ?? [];
  }, [procedure, currentStepIndex]);

  // Trigger a clip only once a step is actually COMPLETED — look up the step
  // by the id in the most recent log entry, not by currentStepIndex, because
  // completing the LAST step doesn't advance currentStepIndex (nothing to
  // advance to), which would otherwise point at the wrong step.
  const lastResult = useProcedureEngine((s) => s.lastResult);
  const log = useProcedureEngine((s) => s.log);
  const activeClipId = useMemo(() => {
    if (!procedure || lastResult?.result !== "correct" || log.length === 0) return null;
    const lastLog = log[log.length - 1];
    const completedStep = procedure.steps.find((s) => s.id === lastLog.stepId);
    return completedStep?.animationClip ?? null;
  }, [procedure, lastResult, log]);

  if (!machine || !machine.procedure || !machine.modelPath) {
    notFound();
  }

  return (
    <main className="h-screen flex flex-col">
      <header className="border-b border-panelBorder px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="readout text-inkDim hover:text-ink">
            ← MACHINES
          </Link>
          <span className="text-sm font-medium">{machine!.name}</span>
        </div>
        <div className="readout text-cyan">SESSION ACTIVE</div>
      </header>

      <div className="flex-1 grid grid-cols-[1fr_320px] min-h-0">
        <div className="min-h-0">
          <MachineViewer
            modelPath={machine!.modelPath!}
            highlightNodes={highlightNodes}
            activeClipId={activeClipId}
          />
        </div>
        <div className="border-l border-panelBorder grid grid-rows-2 min-h-0">
          <div className="min-h-0 overflow-hidden border-b border-panelBorder">
            <ProcedurePanel procedure={machine!.procedure!} />
          </div>
          <div className="min-h-0 overflow-hidden">
            <TutorChat />
          </div>
        </div>
      </div>
    </main>
  );
}
