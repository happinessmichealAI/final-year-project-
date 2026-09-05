import Link from "next/link";
import { MACHINES } from "@/lib/machines";

const icons: Record<string,string> = { "robotic-manipulator":"🤖", "vertical-milling-machine":"⚙️", "electric-hydro-press":"⬇️", "workhorse-3d-printer":"🖨️" };

export default function Home() {
  return <main className="home-shell">
    <header className="home-header"><div><span className="eyebrow">NAUB · MECHANICAL ENGINEERING</span><h1>FINAL YEAR PROJECT · INTERACTIVE MACHINE SKILLS LAB</h1><p>Interactive digital-twin training for machine operation. Students mount workpieces, set controls, operate the machine and receive step-by-step coaching.</p></div><div className="header-badge">4 MACHINES · HANDS-ON MODE</div></header>
    <section className="home-content"><div className="intro-row"><div><span className="eyebrow">SELECT A MACHINE</span><h2>Learn by operating</h2></div><span className="readout-line">3D WORKPLACE + CONTROLS + PROCEDURE + AI</span></div>
      <div className="machine-cards">{MACHINES.map((m)=><Link href={`/machines/${m.slug}`} className="machine-card" key={m.slug}><div className="machine-icon">{icons[m.slug]}</div><div className="machine-card-body"><div className="machine-card-title"><h3>{m.name}</h3><span>READY</span></div><p>{m.description}</p><div className="machine-card-meta"><span>{m.procedure.steps.length} guided steps</span><span>{m.parts.length} named parts</span><span>{m.workpieces.length} workpieces</span></div></div><div className="arrow">→</div></Link>)}</div>
      <div className="home-note"><strong>What changed:</strong> the tensile/bending tester has been removed. The training workspace is now split into a fixed machine/workplace area on top and a separate scrollable learning/control area below, so controls and AI never cover the 3D machine.</div>
    </section>
  </main>;
}
