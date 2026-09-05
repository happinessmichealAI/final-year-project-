"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MachineMeta } from "@/lib/machines";
import { useProcedureEngine } from "@/lib/procedureEngine";
import type { ActionId } from "@/lib/procedures/types";

const MachineViewer = dynamic(() => import("@/components/MachineViewer"), {
  ssr: false,
  loading: () => <div className="viewer-loading">Loading 3D workplace…</div>,
});

type LabState = {
  selectedPart: string | null;
  selectedWorkpiece: number;
  robotPowered: boolean;
  robotSafetyChecked: boolean;
  robotHomed: boolean;
  robotTask: "idle" | "pick" | "place";
  robotProgress: number;
  robotHeld: boolean;
  picked: boolean[];
  millingMounted: boolean;
  millingToolMounted: boolean;
  millingSpindle: boolean;
  millingFeed: boolean;
  millingProgress: number;
  millingSpeedSet: boolean;
  millingCutSet: boolean;
  pressPowered: boolean;
  pressGuardClosed: boolean;
  pressLimitsSet: boolean;
  pressMounted: boolean;
  pressActive: boolean;
  pressProgress: number;
  pressCycleComplete: boolean;
  printerFilamentLoaded: boolean;
  printerHomed: boolean;
  printerHeated: boolean;
  printerJobLoaded: boolean;
  printerPrinting: boolean;
  printerProgress: number;
  printerWorkpiece: number;
  nozzleTemp: number;
  bedTemp: number;
};

const makeInitialState = (): LabState => ({
  selectedPart: null,
  selectedWorkpiece: 0,
  robotPowered: false,
  robotSafetyChecked: false,
  robotHomed: false,
  robotTask: "idle",
  robotProgress: 0,
  robotHeld: false,
  picked: [false, false, false],
  millingMounted: false,
  millingToolMounted: false,
  millingSpindle: false,
  millingFeed: false,
  millingProgress: 0,
  millingSpeedSet: false,
  millingCutSet: false,
  pressPowered: false,
  pressGuardClosed: false,
  pressLimitsSet: false,
  pressMounted: false,
  pressActive: false,
  pressProgress: 0,
  pressCycleComplete: false,
  printerFilamentLoaded: false,
  printerHomed: false,
  printerHeated: false,
  printerJobLoaded: false,
  printerPrinting: false,
  printerProgress: 0,
  printerWorkpiece: 0,
  nozzleTemp: 25,
  bedTemp: 25,
});

const ACTION_LABELS: Record<string, string> = {
  inspect_workspace: "COMPLETE INSPECTION",
  check_safety: "CONFIRM SAFETY READY",
  power_on: "POWER ON",
  home_robot: "HOME ROBOT",
  select_workpiece: "CONFIRM WORKPIECE",
  pick_workpiece: "EXECUTE PICK",
  place_workpiece: "EXECUTE PLACE",
  complete_three_piece_cycle: "RUN REMAINING PIECES",
  inspect_machine: "COMPLETE INSPECTION",
  secure_workpiece: "CLAMP WORKPIECE",
  mount_tool: "MOUNT END MILL",
  set_spindle_speed: "CHECK SPINDLE SPEED",
  start_spindle: "START SPINDLE",
  set_feed_depth: "APPLY FEED & DEPTH",
  engage_feed: "ENGAGE TABLE FEED",
  retract_and_release: "RETRACT / STOP / RELEASE",
  inspect_press: "COMPLETE INSPECTION",
  check_guarding: "CONFIRM GUARD CLOSED",
  set_pressure_limits: "APPLY PRESS SETTINGS",
  position_workpiece: "ALIGN WORKPIECE",
  cycle_press: "START TWO-HAND PRESS",
  release_and_remove: "RELEASE / REMOVE",
  inspect_printer: "COMPLETE INSPECTION",
  load_filament: "LOAD FILAMENT",
  home_axes: "HOME X / Y / Z",
  heat_printer: "HEAT HOTEND + BED",
  load_job: "LOAD PRINT JOB",
  start_print: "START PRINT",
  monitor_print: "CONFIRM PRINT COMPLETE",
  finish_print: "COOL / REMOVE PART",
};

export default function MachineLab({ machine }: { machine: MachineMeta }) {
  const { loadProcedure, procedure, currentStepIndex, lastResult, completed, dispatchAction, dispatchParameters, reset, log } = useProcedureEngine();
  const currentStep = procedure?.steps[currentStepIndex];
  const [state, setState] = useState<LabState>(makeInitialState);
  const [rpm, setRpm] = useState(1200);
  const [feed, setFeed] = useState(0.2);
  const [depth, setDepth] = useState(1);
  const [cutterDiameter, setCutterDiameter] = useState(12);
  const [pressure, setPressure] = useState(55);
  const [stroke, setStroke] = useState(30);
  const [twoHand, setTwoHand] = useState({ left: false, right: false });
  const [tutorLines, setTutorLines] = useState<string[]>(["Select a part to learn its function. Then follow the procedure and operate the controls in sequence. Unsafe or out-of-order machine commands are blocked."]);
  const [tutorInput, setTutorInput] = useState("");
  const [busyAction, setBusyAction] = useState(false);
  const [studentName, setStudentName] = useState("");

  useEffect(() => {
    loadProcedure(machine.procedure);
    setState(makeInitialState());
    setTwoHand({ left: false, right: false });
    try { setStudentName(window.localStorage.getItem("fyp-student-name") ?? ""); } catch {}
  }, [machine.slug, machine.procedure, loadProcedure]);

  useEffect(() => {
    if (!procedure || !lastResult || log.length === 0) return;
    const latest = log[log.length - 1];
    const step = procedure.steps.find((s) => s.id === latest.stepId);
    if (!step) return;
    setTutorLines((prev) => [...prev, `${lastResult.result === "correct" ? "✓ Good." : "⚠ Check this."} ${lastResult.message}`]);
    fetch("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ machineTitle: procedure.title, stepTitle: step.title, stepInstruction: step.instruction, studentAction: latest.studentAction, result: latest.result, templateMessage: lastResult.message, safetyCritical: step.safetyCritical, parameters: latest.parameters ?? null, attemptNumber: latest.attemptNumber }),
    }).then((r) => r.json()).then((data) => {
      if (data.feedback) setTutorLines((prev) => [...prev, `AI TUTOR: ${data.feedback}`]);
    }).catch(() => {});
  }, [log, lastResult, procedure]);

  // Robot animation: each command is deliberately separate so students see
  // approach/pick and transfer/place as different physical operations.
  useEffect(() => {
    if (machine.slug !== "robotic-manipulator" || state.robotTask === "idle") return;
    const id = window.setInterval(() => setState((s) => {
      const next = Math.min(1, s.robotProgress + 0.028);
      return { ...s, robotProgress: next, robotTask: next >= 1 ? "idle" : s.robotTask, robotHeld: s.robotTask === "pick" ? next >= 0.55 || s.robotHeld : s.robotTask === "place" ? next < 0.82 : s.robotHeld };
    }), 55);
    return () => window.clearInterval(id);
  }, [machine.slug, state.robotTask]);

  // Milling progress uses feed and depth: deeper/faster cuts complete faster and
  // are reflected by the visual pass and live load indicator.
  useEffect(() => {
    if (machine.slug !== "vertical-milling-machine" || !state.millingFeed) return;
    const rate = Math.max(0.006, Math.min(0.028, 0.011 + feed * 0.012 + depth * 0.002));
    const id = window.setInterval(() => setState((s) => {
      const next = Math.min(1, s.millingProgress + rate);
      return { ...s, millingProgress: next, millingFeed: next < 1 };
    }), 70);
    return () => window.clearInterval(id);
  }, [machine.slug, state.millingFeed, feed, depth]);

  useEffect(() => {
    if (machine.slug === "vertical-milling-machine" && state.millingProgress >= 0.999 && currentStep?.id === "vmm-07") {
      setState((s) => ({ ...s, millingFeed: false }));
      dispatchAction("engage_feed");
    }
  }, [machine.slug, state.millingProgress, currentStep?.id, dispatchAction]);

  useEffect(() => {
    if (machine.slug !== "electric-hydro-press" || !state.pressActive) return;
    const rate = Math.max(0.012, Math.min(0.035, 0.018 + pressure / 5000 + stroke / 5000));
    const id = window.setInterval(() => setState((s) => {
      const next = s.pressProgress < 1 ? Math.min(1, s.pressProgress + rate) : Math.max(0, s.pressProgress - rate * 0.72);
      const finished = s.pressProgress >= 1 && next <= 0.01;
      return { ...s, pressProgress: next, pressActive: !finished, pressCycleComplete: finished };
    }), 55);
    return () => window.clearInterval(id);
  }, [machine.slug, state.pressActive, pressure, stroke]);

  useEffect(() => {
    if (machine.slug === "electric-hydro-press" && state.pressCycleComplete && currentStep?.id === "ehp-06") {
      dispatchAction("cycle_press");
    }
  }, [machine.slug, state.pressCycleComplete, currentStep?.id, dispatchAction]);

  // Printer heating is gradual, and print progress controls layers/toolpath.
  useEffect(() => {
    if (machine.slug !== "workhorse-3d-printer" || !state.printerHeated || state.printerPrinting) return;
    if (state.nozzleTemp >= 205 && state.bedTemp >= 60) return;
    const id = window.setInterval(() => setState((s) => ({
      ...s,
      nozzleTemp: Math.min(205, s.nozzleTemp + 5),
      bedTemp: Math.min(60, s.bedTemp + 2),
    })), 180);
    return () => window.clearInterval(id);
  }, [machine.slug, state.printerHeated, state.printerPrinting, state.nozzleTemp, state.bedTemp]);

  useEffect(() => {
    if (machine.slug !== "workhorse-3d-printer" || !state.printerPrinting) return;
    const id = window.setInterval(() => setState((s) => {
      const next = Math.min(1, s.printerProgress + 0.0055);
      return { ...s, printerProgress: next, printerPrinting: next < 1 };
    }), 100);
    return () => window.clearInterval(id);
  }, [machine.slug, state.printerPrinting]);

  const progress = procedure ? Math.round((Math.min(currentStepIndex, procedure.steps.length) / procedure.steps.length) * 100) : 0;
  const selectedPart = useMemo(() => machine.parts.find((p) => p.id === state.selectedPart), [machine.parts, state.selectedPart]);

  const teach = (message: string) => setTutorLines((prev) => [...prev, message]);

  const rejectOutOfSequence = (message: string) => {
    teach(`⚠ CONTROL INTERLOCK: ${message}`);
  };

  const performAction = (action: ActionId) => {
    if (!currentStep || completed || busyAction) return;
    if (!currentStep.acceptedActions.includes(action)) {
      rejectOutOfSequence(`The current training step is “${currentStep.title}”. Complete that step before using this control.`);
      return;
    }

    if (machine.slug === "robotic-manipulator") {
      if (action === "pick_workpiece") {
        if (!state.robotPowered || !state.robotHomed) return rejectOutOfSequence("Power on and home the robot before motion.");
        if (state.picked[state.selectedWorkpiece]) return rejectOutOfSequence("That workpiece has already been placed. Select one that remains on the source table.");
        setBusyAction(true);
        setState((s) => ({ ...s, robotTask: "pick", robotProgress: 0, robotHeld: false }));
        window.setTimeout(() => {
          setState((s) => ({ ...s, robotTask: "idle", robotProgress: 1, robotHeld: true }));
          dispatchAction(action);
          setBusyAction(false);
        }, 2200);
        return;
      }
      if (action === "place_workpiece") {
        if (!state.robotHeld) return rejectOutOfSequence("The gripper is not holding a workpiece. Complete the pick operation first.");
        setBusyAction(true);
        setState((s) => ({ ...s, robotTask: "place", robotProgress: 0 }));
        window.setTimeout(() => {
          setState((s) => ({ ...s, picked: s.picked.map((v, i) => i === s.selectedWorkpiece ? true : v), robotHeld: false, robotTask: "idle", robotProgress: 1 }));
          dispatchAction(action);
          setBusyAction(false);
        }, 2200);
        return;
      }
      if (action === "complete_three_piece_cycle") {
        if (!state.robotPowered || !state.robotHomed) {
          rejectOutOfSequence("Power on and home the robot before repeating the cycle.");
          return;
        }
        if (state.picked.every(Boolean)) {
          dispatchAction(action);
          return;
        }
        if (busyAction) return;
        const remaining = state.picked.map((done, i) => done ? -1 : i).filter((i) => i >= 0);
        setBusyAction(true);
        const runPiece = (position: number) => {
          const piece = remaining[position];
          if (piece === undefined) {
            setBusyAction(false);
            dispatchAction(action);
            return;
          }
          setState((s) => ({ ...s, selectedWorkpiece: piece, robotTask: "pick", robotProgress: 0, robotHeld: false }));
          window.setTimeout(() => setState((s) => ({ ...s, robotTask: "place", robotProgress: 0, robotHeld: true })), 2200);
          window.setTimeout(() => {
            setState((s) => ({ ...s, picked: s.picked.map((v, i) => i === piece ? true : v), robotTask: "idle", robotProgress: 1, robotHeld: false }));
            window.setTimeout(() => runPiece(position + 1), 350);
          }, 4400);
        };
        runPiece(0);
        return;
      }
      if (action === "check_safety") setState((s) => ({ ...s, robotSafetyChecked: true }));
      if (action === "power_on") {
        if (!state.robotSafetyChecked) return rejectOutOfSequence("Confirm the emergency-stop/guarding check before powering the controller.");
        setState((s) => ({ ...s, robotPowered: true }));
      }
      if (action === "home_robot") {
        if (!state.robotPowered) return rejectOutOfSequence("Power on the controller before homing the manipulator.");
        setState((s) => ({ ...s, robotHomed: true }));
      }
      dispatchAction(action);
      return;
    }

    if (machine.slug === "vertical-milling-machine") {
      if (action === "secure_workpiece") {
        setState((s) => ({ ...s, millingMounted: true, millingProgress: 0 }));
        dispatchAction(action);
        return;
      }
      if (action === "mount_tool") {
        if (!state.millingMounted) return rejectOutOfSequence("Clamp the workpiece before installing the cutter for this training sequence.");
        setState((s) => ({ ...s, millingToolMounted: true }));
        dispatchAction(action);
        return;
      }
      if (action === "start_spindle") {
        if (!state.millingMounted || !state.millingToolMounted || !state.millingSpeedSet) return rejectOutOfSequence("Clamp the workpiece, mount the cutter and verify spindle speed before starting.");
        setState((s) => ({ ...s, millingSpindle: true }));
        dispatchAction(action);
        return;
      }
      if (action === "engage_feed") {
        if (!state.millingMounted || !state.millingToolMounted || !state.millingSpindle || !state.millingCutSet) return rejectOutOfSequence("Complete workholding, tool setup, spindle setup and feed/depth settings before cutting.");
        setState((s) => ({ ...s, millingFeed: true, millingProgress: Math.min(s.millingProgress, 0.98) }));
        return;
      }
      if (action === "retract_and_release") {
        if (state.millingProgress < 0.98 || state.millingFeed) return rejectOutOfSequence("Let the cutting pass finish, then stop/retract before releasing the workpiece.");
        setState((s) => ({ ...s, millingMounted: false, millingSpindle: false, millingFeed: false }));
        dispatchAction(action);
        return;
      }
      dispatchAction(action);
      return;
    }

    if (machine.slug === "electric-hydro-press") {
      if (action === "power_on") setState((s) => ({ ...s, pressPowered: true }));
      if (action === "check_guarding") setState((s) => ({ ...s, pressGuardClosed: true }));
      if (action === "set_pressure_limits") setState((s) => ({ ...s, pressLimitsSet: true }));
      if (action === "position_workpiece") {
        if (!state.pressPowered || !state.pressGuardClosed || !state.pressLimitsSet) return rejectOutOfSequence("Power, guarding and pressure/stroke setup must be complete before loading the workpiece.");
        setState((s) => ({ ...s, pressMounted: true, pressCycleComplete: false }));
      }
      if (action === "cycle_press") {
        if (!state.pressPowered || !state.pressGuardClosed || !state.pressLimitsSet || !state.pressMounted) return rejectOutOfSequence("The press is not ready. Complete setup and align the workpiece first.");
        if (!twoHand.left || !twoHand.right) return rejectOutOfSequence("Both two-hand controls must be held together.");
        setState((s) => ({ ...s, pressActive: true, pressProgress: 0, pressCycleComplete: false }));
        return;
      }
      if (action === "release_and_remove") {
        if (!state.pressCycleComplete || state.pressProgress > 0.02) return rejectOutOfSequence("Wait until the ram completes its stroke and fully retracts before removal.");
        setState((s) => ({ ...s, pressMounted: false, pressActive: false, pressProgress: 0 }));
        setTwoHand({ left: false, right: false });
      }
      dispatchAction(action);
      return;
    }

    if (machine.slug === "workhorse-3d-printer") {
      if (action === "load_filament") setState((s) => ({ ...s, printerFilamentLoaded: true }));
      if (action === "home_axes") {
        if (!state.printerFilamentLoaded) return rejectOutOfSequence("Load the filament path before running this training sequence's homing step.");
        setState((s) => ({ ...s, printerHomed: true }));
      }
      if (action === "heat_printer") {
        if (!state.printerHomed) return rejectOutOfSequence("Home X, Y and Z before heating for the print cycle.");
        setState((s) => ({ ...s, printerHeated: true }));
      }
      if (action === "load_job") {
        if (!state.printerHeated || state.nozzleTemp < 205 || state.bedTemp < 60) return rejectOutOfSequence("Wait until the hotend and bed reach their target temperatures.");
        setState((s) => ({ ...s, printerJobLoaded: true }));
      }
      if (action === "start_print") {
        if (!state.printerFilamentLoaded || !state.printerHomed || !state.printerHeated || !state.printerJobLoaded) return rejectOutOfSequence("Filament, homing, heating and the print job must all be ready before starting.");
        setState((s) => ({ ...s, printerPrinting: true, printerProgress: 0 }));
      }
      if (action === "monitor_print" && state.printerProgress < 0.98) return rejectOutOfSequence("Keep monitoring until the print reaches completion.");
      if (action === "finish_print") {
        if (state.printerProgress < 0.98) return rejectOutOfSequence("Do not remove a part while the print is still running.");
        setState((s) => ({ ...s, printerPrinting: false, printerHeated: false, nozzleTemp: 45, bedTemp: 35, printerProgress: 1 }));
      }
      dispatchAction(action);
    }
  };

  const submitSpeed = () => {
    if (!currentStep || currentStep.id !== "vmm-04") return rejectOutOfSequence("Spindle speed can only be checked at the spindle-speed step.");
    dispatchParameters({ diameterMm: cutterDiameter, rpm });
    const vc = Math.PI * cutterDiameter * rpm / 1000;
    if (vc >= 20 && vc <= 35) setState((s) => ({ ...s, millingSpeedSet: true }));
  };

  const submitCutSettings = () => {
    if (!currentStep || currentStep.id !== "vmm-06") return rejectOutOfSequence("Feed and depth can only be applied at the feed/depth setup step.");
    const result = dispatchParameters({ feed, depth });
    void result;
    if (feed > 0 && depth > 0 && feed <= 0.8 && depth <= 2.5) setState((s) => ({ ...s, millingCutSet: true }));
  };

  const submitPressSettings = () => {
    if (!currentStep || currentStep.id !== "ehp-04") return rejectOutOfSequence("Pressure and stroke can only be applied at the press setup step.");
    if (pressure < 25 || pressure > 80 || stroke < 10 || stroke > 55) {
      teach("⚠ Choose moderate educational settings: pressure 25–80% and stroke 10–55 mm.");
      return;
    }
    setState((s) => ({ ...s, pressLimitsSet: true }));
    dispatchAction("set_pressure_limits");
  };

  const chooseWorkpiece = (index: number) => {
    if (machine.slug === "workhorse-3d-printer") {
      if (currentStep?.id !== "3dp-05") return rejectOutOfSequence("Select the print job during the Load Print Job step.");
      setState((s) => ({ ...s, printerWorkpiece: index }));
      return;
    }
    if (machine.slug === "robotic-manipulator" && currentStep?.id !== "rm-05") return rejectOutOfSequence("Select a workpiece during the workpiece-selection step.");
    if (machine.slug === "vertical-milling-machine" && currentStep?.id !== "vmm-02") return rejectOutOfSequence("Select the stock during the workholding step.");
    if (machine.slug === "electric-hydro-press" && currentStep?.id !== "ehp-05") return rejectOutOfSequence("Select the press sample during the alignment step.");
    setState((s) => ({ ...s, selectedWorkpiece: index }));
  };

  const saveStudentName = (value: string) => {
    setStudentName(value);
    try { window.localStorage.setItem("fyp-student-name", value); } catch {}
  };

  const resetLab = () => {
    reset();
    setState(makeInitialState());
    setTwoHand({ left: false, right: false });
    setBusyAction(false);
    setTutorLines(["Session reset. Start with the safety inspection."]);
  };

  const askTutor = () => {
    const q = tutorInput.trim();
    if (!q) return;
    setTutorLines((p) => [...p, `YOU: ${q}`]);
    setTutorInput("");
    const text = q.toLowerCase();
    let answer = `You are on “${currentStep?.title ?? "Procedure complete"}”. ${currentStep?.instruction ?? "Reset the session to practice again."}`;
    if (text.includes("workpiece") || text.includes("mount")) answer = "Workholding keeps the material in a known position so the machine can apply its operation predictably. Complete the mounting/alignment step before machine motion.";
    else if (text.includes("safe") || text.includes("guard") || text.includes("emergency")) answer = "Safety interlocks are deliberate: the simulator blocks motion when a required guarding or setup condition is missing. Treat the virtual sequence like a real pre-start check.";
    else if (machine.slug === "vertical-milling-machine" && (text.includes("rpm") || text.includes("speed"))) answer = `Current cutting speed is ${(Math.PI * cutterDiameter * rpm / 1000).toFixed(1)} m/min. In this educational setup, the target band is 20–35 m/min.`;
    else if (machine.slug === "electric-hydro-press" && text.includes("pressure")) answer = `The selected press setting is ${pressure}% with ${stroke} mm stroke. Pressure provides the force capability; stroke defines the ram travel used in this exercise.`;
    else if (machine.slug === "workhorse-3d-printer" && text.includes("temperature")) answer = `The simulated hotend is ${state.nozzleTemp}°C and the bed is ${state.bedTemp}°C. The print job is enabled only after the target temperatures are reached.`;
    window.setTimeout(() => setTutorLines((p) => [...p, `TUTOR: ${answer}`]), 200);
  };

  const primaryAction = currentStep?.acceptedActions[0] as ActionId | undefined;
  const primaryLabel = primaryAction ? ACTION_LABELS[primaryAction] ?? primaryAction.replaceAll("_", " ").toUpperCase() : "PROCEDURE COMPLETE";

  return (
    <main className="lab-shell">
      <section className="machine-section">
        <div className="machine-topbar">
          <div><Link href="/" className="back-link">← MACHINES</Link><span className="machine-title">{machine.name}</span></div>
          <div className="machine-status">FINAL YEAR PROJECT · {completed ? "EXERCISE COMPLETE" : "TRAINING ACTIVE"}</div>
        </div>
        <div className="machine-viewport">
          <MachineViewer machineSlug={machine.slug} state={state} onPartSelect={(id) => setState((s) => ({ ...s, selectedPart: id }))} />
          <div className="viewport-overlay">
            <div><strong>{machine.shortName}</strong><span>{machine.description}</span>{selectedPart && <small>Selected: {selectedPart.name}</small>}</div>
            <div className="overlay-progress"><span>{progress}% procedure</span><div><i style={{ width: `${progress}%` }} /></div></div>
          </div>
        </div>
      </section>

      <section className="learning-section">
        <div className="learning-inner">
          <div className="section-heading"><div><span className="eyebrow">TRAINING WORKSPACE</span><h1>Operate, observe and learn</h1><p>The machine stays visible above. This lower section contains the procedure, real machine controls, workholding, named parts and tutor. Controls are interlocked with the training state.</p></div><button className="ghost-btn" onClick={resetLab}>RESET SESSION</button></div>

          <div className="learning-grid">
            <div className="main-learning">
              <div className="card step-card">
                <div className="card-title"><span>PROCEDURE · STEP {Math.min(currentStepIndex + 1, machine.procedure.steps.length)} / {machine.procedure.steps.length}</span>{currentStep?.safetyCritical && <b className="danger-tag">SAFETY CRITICAL</b>}</div>
                <h2>{currentStep?.title ?? "Exercise complete"}</h2>
                <p>{currentStep?.instruction ?? "You have completed this machine exercise. Reset to practice again."}</p>
                {!completed && <div className="action-area">
                  {(currentStep?.id === "rm-05" || currentStep?.id === "vmm-02" || currentStep?.id === "ehp-05" || currentStep?.id === "3dp-05") && <div className="workpiece-choice">{machine.workpieces.map((w, i) => <button key={w} className={(machine.slug === "workhorse-3d-printer" ? state.printerWorkpiece : state.selectedWorkpiece) === i ? "selected" : ""} onClick={() => chooseWorkpiece(i)}>{i + 1}. {w}</button>)}</div>}
                  {currentStep?.id === "vmm-04" && <div className="parameter-grid"><label>Cutter diameter<input type="number" min="1" value={cutterDiameter} onChange={(e) => setCutterDiameter(Number(e.target.value))} /><small>mm</small></label><label>Spindle speed<input type="number" min="100" value={rpm} onChange={(e) => setRpm(Number(e.target.value))} /><small>RPM</small></label></div>}
                  {currentStep?.id === "vmm-06" && <div className="parameter-grid"><label>Feed<input type="number" min="0.05" max="1" step="0.01" value={feed} onChange={(e) => setFeed(Number(e.target.value))} /><small>mm/rev</small></label><label>Depth of cut<input type="number" min="0.1" max="3" step="0.1" value={depth} onChange={(e) => setDepth(Number(e.target.value))} /><small>mm</small></label></div>}
                  {currentStep?.id === "ehp-04" && <div className="parameter-grid"><label>Pressure<input type="range" min="20" max="90" value={pressure} onChange={(e) => setPressure(Number(e.target.value))} /><small>{pressure}%</small></label><label>Stroke<input type="range" min="10" max="60" value={stroke} onChange={(e) => setStroke(Number(e.target.value))} /><small>{stroke} mm</small></label></div>}
                  {currentStep?.id === "ehp-06" && <div className="two-hand"><button className={twoHand.left ? "pressed" : ""} onClick={() => setTwoHand((s) => ({ ...s, left: !s.left }))}>LEFT TWO-HAND {twoHand.left ? "✓" : ""}</button><button className={twoHand.right ? "pressed" : ""} onClick={() => setTwoHand((s) => ({ ...s, right: !s.right }))}>RIGHT TWO-HAND {twoHand.right ? "✓" : ""}</button></div>}
                  {currentStep?.id === "rm-08" && <div className="cycle-summary">Target tray: {state.picked.filter(Boolean).length} / 3 pieces placed. The final step only passes after all three pieces have completed pick-and-place.</div>}
                  <button className="primary-action" onClick={() => currentStep?.id === "vmm-04" ? submitSpeed() : currentStep?.id === "vmm-06" ? submitCutSettings() : currentStep?.id === "ehp-04" ? submitPressSettings() : primaryAction ? performAction(primaryAction) : undefined} disabled={busyAction || completed || (currentStep?.id === "ehp-06" && !(twoHand.left && twoHand.right))}>{primaryLabel}</button>
                </div>}
                {lastResult && <div className={`result-box ${lastResult.result}`}>{lastResult.message}</div>}
              </div>

              <div className="card controls-card">
                <div className="card-title"><span>MACHINE CONTROLS</span><span className="muted">Physical controls are interlocked with the procedure</span></div>

                {machine.slug === "robotic-manipulator" && <>
                  <div className="control-row"><div><b>Workpiece selector</b><small>{machine.workpieces[state.selectedWorkpiece]} · {state.picked[state.selectedWorkpiece] ? "placed in tray" : "on source table"}</small></div><div className="inline-buttons">{machine.workpieces.map((w, i) => <button key={w} onClick={() => chooseWorkpiece(i)}>{i + 1}</button>)}</div></div>
                  <div className="control-row"><div><b>Emergency stop / guarding</b><small>{state.robotSafetyChecked ? "Checked · gate closed" : "Pre-start check required"}</small></div><button onClick={() => performAction("check_safety")} disabled={currentStep?.id !== "rm-02"}>{state.robotSafetyChecked ? "SAFETY OK" : "CHECK SAFETY"}</button></div>
                  <div className="control-row"><div><b>Controller power</b><small>{state.robotPowered ? "Ready" : "Off"}</small></div><button onClick={() => performAction("power_on")} disabled={currentStep?.id !== "rm-03"}>{state.robotPowered ? "POWERED" : "POWER ON"}</button></div>
                  <div className="control-row"><div><b>Home / reference</b><small>{state.robotHomed ? "Reference position established" : "Not homed"}</small></div><button onClick={() => performAction("home_robot")} disabled={currentStep?.id !== "rm-04"}>HOME ROBOT</button></div>
                  <div className="control-row"><div><b>Gripper</b><small>{state.robotHeld ? "Holding selected workpiece" : "Open / empty"}</small></div><button onClick={() => performAction("pick_workpiece")} disabled={currentStep?.id !== "rm-06" || busyAction}>{state.robotHeld ? "HOLDING" : "PICK"}</button></div>
                  <div className="control-row"><div><b>Target tray</b><small>{state.picked.filter(Boolean).length} / 3 placed</small></div><button onClick={() => performAction("place_workpiece")} disabled={currentStep?.id !== "rm-07" || busyAction || !state.robotHeld}>PLACE</button></div>
                </>}

                {machine.slug === "vertical-milling-machine" && <>
                  <div className="control-row"><div><b>Workpiece</b><small>{machine.workpieces[state.selectedWorkpiece]} · {state.millingMounted ? "clamped" : "not clamped"}</small></div><div className="inline-buttons">{machine.workpieces.map((w, i) => <button key={w} onClick={() => chooseWorkpiece(i)} disabled={state.millingMounted}>{i + 1}</button>)}</div></div>
                  <div className="control-grid-3"><label>RPM<input type="range" min="200" max="2500" value={rpm} onChange={(e) => setRpm(Number(e.target.value))} disabled={state.millingSpindle} /><span>{rpm}</span></label><label>Feed<input type="range" min="0.05" max="1" step="0.01" value={feed} onChange={(e) => setFeed(Number(e.target.value))} disabled={state.millingFeed} /><span>{feed.toFixed(2)} mm/rev</span></label><label>Depth<input type="range" min="0.1" max="3" step="0.1" value={depth} onChange={(e) => setDepth(Number(e.target.value))} disabled={state.millingFeed} /><span>{depth.toFixed(1)} mm</span></label></div>
                  <div className="control-row"><div><b>Vice</b><small>{state.millingMounted ? "Moving jaw closed · workpiece clamped" : "Open · workpiece can be loaded"}</small></div><button onClick={() => performAction("secure_workpiece")} disabled={currentStep?.id !== "vmm-02"}>{state.millingMounted ? "CLAMPED" : "CLAMP WORKPIECE"}</button></div>
                  <div className="control-row"><div><b>End mill</b><small>{state.millingToolMounted ? "Tool secured in holder" : "Tool not installed"}</small></div><button onClick={() => performAction("mount_tool")} disabled={currentStep?.id !== "vmm-03"}>{state.millingToolMounted ? "SECURED" : "MOUNT CUTTER"}</button></div>
                  <div className="control-row"><div><b>Spindle</b><small>{state.millingSpindle ? `${rpm} RPM · rotating` : "Stopped"}</small></div><button onClick={() => performAction("start_spindle")} disabled={currentStep?.id !== "vmm-05" || !state.millingSpeedSet}>{state.millingSpindle ? "RUNNING" : "START SPINDLE"}</button></div>
                  <div className="control-row"><div><b>Table feed / cutting</b><small>{state.millingFeed ? `Cutting ${Math.round(state.millingProgress * 100)}%` : "Ready after feed/depth setup"}</small></div><button onClick={() => performAction("engage_feed")} disabled={currentStep?.id !== "vmm-07" || !state.millingSpindle || !state.millingCutSet}>{state.millingFeed ? "CUTTING…" : "ENGAGE FEED"}</button></div>
                  {state.millingProgress > 0 && <div className="progress-track"><i style={{ width: `${Math.round(state.millingProgress * 100)}%` }} /></div>}
                </>}

                {machine.slug === "electric-hydro-press" && <>
                  <div className="control-grid-3"><label>Pressure<input type="range" min="20" max="90" value={pressure} onChange={(e) => setPressure(Number(e.target.value))} disabled={state.pressActive} /><span>{pressure}%</span></label><label>Stroke<input type="range" min="10" max="60" value={stroke} onChange={(e) => setStroke(Number(e.target.value))} disabled={state.pressActive} /><span>{stroke} mm</span></label><div className="live-readout"><b>Hydraulic system</b><span>{state.pressPowered ? "PRESSURIZED / READY" : "OFF"}</span></div></div>
                  <div className="control-row"><div><b>Hydraulic power</b><small>{state.pressPowered ? "Power unit running" : "Power unit off"}</small></div><button onClick={() => performAction("power_on")} disabled={currentStep?.id !== "ehp-03"}>{state.pressPowered ? "POWERED" : "POWER ON"}</button></div>
                  <div className="control-row"><div><b>Workpiece</b><small>{machine.workpieces[state.selectedWorkpiece]} · {state.pressMounted ? "aligned on lower die" : "not loaded"}</small></div><div className="inline-buttons">{machine.workpieces.map((w, i) => <button key={w} onClick={() => chooseWorkpiece(i)} disabled={state.pressMounted}>{i + 1}</button>)}</div></div>
                  <div className="control-row"><div><b>Guard</b><small>{state.pressGuardClosed ? "Closed / interlocked" : "Open"}</small></div><button onClick={() => performAction("check_guarding")} disabled={currentStep?.id !== "ehp-02"}>{state.pressGuardClosed ? "CLOSED" : "CLOSE GUARD"}</button></div>
                  <div className="control-row"><div><b>Two-hand station</b><small>L {twoHand.left ? "ON" : "OFF"} · R {twoHand.right ? "ON" : "OFF"}</small></div><div className="inline-buttons"><button className={twoHand.left ? "pressed" : ""} onClick={() => setTwoHand((s) => ({ ...s, left: !s.left }))}>L</button><button className={twoHand.right ? "pressed" : ""} onClick={() => setTwoHand((s) => ({ ...s, right: !s.right }))}>R</button></div></div>
                  <div className="control-row"><div><b>Press cycle</b><small>{state.pressActive ? `Ram stroke ${Math.round(state.pressProgress * 100)}%` : state.pressCycleComplete ? "Stroke complete / retract" : "Waiting for command"}</small></div><button onClick={() => performAction("cycle_press")} disabled={currentStep?.id !== "ehp-06" || !(twoHand.left && twoHand.right) || !state.pressMounted}>{state.pressActive ? "PRESSING…" : "START PRESS"}</button></div>
                  {state.pressProgress > 0 && <div className="progress-track"><i style={{ width: `${Math.round(state.pressProgress * 100)}%` }} /></div>}
                </>}

                {machine.slug === "workhorse-3d-printer" && <>
                  <div className="control-row"><div><b>Print job</b><small>{machine.workpieces[state.printerWorkpiece]} · {state.printerJobLoaded ? "loaded" : "not loaded"}</small></div><div className="inline-buttons">{machine.workpieces.map((w, i) => <button key={w} onClick={() => chooseWorkpiece(i)}>{i + 1}</button>)}</div></div>
                  <div className="control-grid-3"><div className="live-readout"><b>Nozzle</b><span>{state.nozzleTemp}°C</span></div><div className="live-readout"><b>Bed</b><span>{state.bedTemp}°C</span></div><div className="live-readout"><b>Layer</b><span>{Math.min(18, Math.floor(state.printerProgress * 18))} / 18</span></div></div>
                  <div className="control-row"><div><b>Filament</b><small>{state.printerFilamentLoaded ? "Loaded through extruder path" : "Not loaded"}</small></div><button onClick={() => performAction("load_filament")} disabled={currentStep?.id !== "3dp-02"}>{state.printerFilamentLoaded ? "LOADED" : "LOAD FILAMENT"}</button></div>
                  <div className="control-row"><div><b>Axis homing</b><small>{state.printerHomed ? "X/Y/Z referenced" : "Not homed"}</small></div><button onClick={() => performAction("home_axes")} disabled={currentStep?.id !== "3dp-03"}>{state.printerHomed ? "HOMED" : "HOME AXES"}</button></div>
                  <div className="control-row"><div><b>Heating</b><small>{state.printerHeated ? "Target 205°C / 60°C" : "Cold / safe"}</small></div><button onClick={() => performAction("heat_printer")} disabled={currentStep?.id !== "3dp-04"}>{state.printerHeated ? "HEATING / READY" : "HEAT"}</button></div>
                  <div className="control-row"><div><b>Print</b><small>{state.printerPrinting ? `Layer ${Math.min(18, Math.floor(state.printerProgress * 18))} of 18` : state.printerProgress >= .98 ? "Complete" : "Ready"}</small></div><button onClick={() => performAction("start_print")} disabled={currentStep?.id !== "3dp-06" || !state.printerJobLoaded || state.nozzleTemp < 205}>{state.printerPrinting ? "PRINTING…" : "START PRINT"}</button></div>
                  <div className="progress-track"><i style={{ width: `${Math.round(state.printerProgress * 100)}%` }} /></div>
                </>}
              </div>

              <div className="card parts-card"><div className="card-title"><span>PARTS & FUNCTIONS</span><span className="muted">Every listed component is selectable in the 3D workplace</span></div><div className="parts-grid">{machine.parts.map((part) => <button key={part.id} className={state.selectedPart === part.id ? "part-active" : ""} onClick={() => setState((s) => ({ ...s, selectedPart: part.id }))}><strong>{part.name}</strong><span>{part.function}</span></button>)}</div></div>

              <div className="card tutor-card"><div className="card-title"><span>AI TUTOR</span><span className="muted">Procedure engine assesses; tutor explains</span></div><div className="tutor-log">{tutorLines.map((line, i) => <p key={i}>{line}</p>)}</div><div className="tutor-input"><input value={tutorInput} onChange={(e) => setTutorInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && askTutor()} placeholder="Ask about setup, safety, workholding or machine operation…"/><button onClick={askTutor}>ASK</button></div></div>
            </div>

            <aside className="side-learning">
              <div className="card checklist-card"><div className="card-title"><span>PROCEDURE CHECKLIST</span></div>{machine.procedure.steps.map((step, i) => <div key={step.id} className={`check-step ${i < currentStepIndex || completed ? "done" : ""} ${i === currentStepIndex && !completed ? "current" : ""}`}><span>{i < currentStepIndex || completed ? "✓" : String(i + 1).padStart(2, "0")}</span><div><b>{step.title}</b>{step.safetyCritical && <em>SAFETY</em>}</div></div>)}</div>
              <div className="card state-card"><div className="card-title"><span>LIVE MACHINE STATE</span></div>
                <div className="state-row"><span>Workpiece</span><b>{machine.slug === "workhorse-3d-printer" ? machine.workpieces[state.printerWorkpiece] : machine.workpieces[state.selectedWorkpiece]}</b></div>
                <div className="state-row"><span>Setup</span><b>{machine.slug === "robotic-manipulator" ? (state.robotHomed ? "HOMED" : state.robotPowered ? "POWERED" : state.robotSafetyChecked ? "SAFETY CHECKED" : "OFF") : machine.slug === "vertical-milling-machine" ? (state.millingMounted ? "CLAMPED" : "OPEN VICE") : machine.slug === "electric-hydro-press" ? (state.pressMounted ? "ALIGNED" : state.pressPowered ? "READY" : "OFF") : state.printerPrinting ? "PRINTING" : state.printerHeated ? "HEATED" : state.printerFilamentLoaded ? "FILAMENT LOADED" : "COLD"}</b></div>
                <div className="state-row"><span>Motion</span><b>{machine.slug === "vertical-milling-machine" ? state.millingFeed ? "CUTTING" : state.millingSpindle ? "SPINDLE RUNNING" : "IDLE" : machine.slug === "electric-hydro-press" ? state.pressActive ? "RAM MOVING" : "IDLE" : machine.slug === "workhorse-3d-printer" ? state.printerPrinting ? "PRINTING" : "IDLE" : state.robotTask === "pick" ? "PICKING" : state.robotTask === "place" ? "PLACING" : state.robotHeld ? "HOLDING" : "READY"}</b></div>
                <div className="state-row"><span>Selected part</span><b>{selectedPart?.name ?? "None"}</b></div>
              </div>
              <div className="card assessment-card"><div className="card-title"><span>STUDENT SESSION</span><span className="muted">Local session record</span></div><label className="student-name">Student name<input value={studentName} onChange={(e) => saveStudentName(e.target.value)} placeholder="Enter your name" /></label><div className="assessment-grid"><div><b>{log.length}</b><span>attempts</span></div><div><b>{log.filter((x) => x.result === "correct").length}</b><span>correct actions</span></div><div><b>{log.filter((x) => x.result === "safety_violation").length}</b><span>safety violations</span></div><div><b>{Math.round((currentStepIndex / machine.procedure.steps.length) * 100)}%</b><span>completion</span></div></div><small className="assessment-note">The current browser session is attributable through an anonymous session ID. Verified student authentication and tamper-resistant assessment require Supabase Auth + RLS.</small></div>
              <div className="card learning-note"><div className="card-title"><span>TRAINING PRINCIPLE</span></div><p>Virtual actions mirror the order a student should use on a real machine. The simulation intentionally blocks unsafe/out-of-order motion instead of letting the learner bypass setup.</p></div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
