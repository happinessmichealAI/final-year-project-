import Link from "next/link";
import { MACHINES } from "@/lib/machines";

const statusLabel: Record<string, { text: string; color: string }> = {
  ready: { text: "READY", color: "text-ok" },
  needs_compression: { text: "NEEDS WORK", color: "text-amber" },
  blocked_no_model: { text: "BLOCKED", color: "text-fault" },
};

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-panelBorder px-6 py-5">
        <div className="readout uppercase tracking-wide">NAUB · Mechanical Engineering</div>
        <h1 className="text-xl font-semibold mt-1">AI-Assisted Digital Twin Learning Environment</h1>
      </header>

      <div className="px-6 py-6 max-w-3xl">
        <p className="text-sm text-inkDim leading-relaxed mb-6 max-w-xl">
          Select a machine to begin a guided operating procedure. Each session is checked
          step-by-step against a fixed procedure and coached by an AI tutor.
        </p>

        <div className="border border-panelBorder divide-y divide-panelBorder">
          {MACHINES.map((m) => {
            const status = statusLabel[m.status];
            const clickable = Boolean(m.modelPath && m.procedure);
            const Wrapper = clickable ? Link : "div";
            const wrapperProps = clickable ? { href: `/machines/${m.slug}` } : {};
            return (
              <Wrapper
                key={m.slug}
                {...(wrapperProps as any)}
                className={`flex items-center justify-between px-4 py-4 ${
                  clickable ? "hover:bg-panel cursor-pointer" : "opacity-60"
                }`}
              >
                <div>
                  <div className="text-sm font-medium">{m.name}</div>
                  <div className="text-xs text-inkDim mt-0.5 max-w-md">{m.statusNote}</div>
                </div>
                <div className={`readout ${status.color}`}>{status.text}</div>
              </Wrapper>
            );
          })}
        </div>
      </div>
    </main>
  );
}
