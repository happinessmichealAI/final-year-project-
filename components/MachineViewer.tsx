"use client";

import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef } from "react";
import type { ErrorInfo, MutableRefObject, ReactNode } from "react";
import * as THREE from "three";

export interface MachineVisualState {
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
}

interface Props {
  machineSlug: string;
  state: MachineVisualState;
  onPartSelect: (id: string) => void;
  onPartRelease?: () => void;
  resetToken?: number;
  partNumbers?: Record<string, number>;
}

const CAMERA_CONFIG: Record<string, { position: [number, number, number]; target: [number, number, number]; fov: number; minDistance: number; maxDistance: number }> = {
  "robotic-manipulator": { position: [7.8, 5.6, 8.4], target: [0, 1.15, 0], fov: 43, minDistance: 5.2, maxDistance: 16 },
  "vertical-milling-machine": { position: [8.7, 6.9, 9.8], target: [0.25, 1.85, 0], fov: 46, minDistance: 6, maxDistance: 20 },
  "electric-hydro-press": { position: [8.4, 5.7, 9.2], target: [0, 1.55, 0], fov: 43, minDistance: 6, maxDistance: 18 },
  "workhorse-3d-printer": { position: [6.7, 4.9, 7.5], target: [0, 0.7, 0], fov: 41, minDistance: 5, maxDistance: 15 },
};

class ViewerErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Machine viewport error", error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="viewer-crash"><strong>3D workplace could not render</strong><span>{this.state.error.message || "Unknown rendering error."}</span><button onClick={() => this.setState({ error: null })}>RETRY VIEWPORT</button></div>;
  }
}

function Label({ name, position, active }: { name: string; position: [number, number, number]; active: boolean }) {
  return <Html position={position} center distanceFactor={7} style={{ pointerEvents: "none" }}><div className={`machine-label ${active ? "machine-label-active" : ""}`}>{name}</div></Html>;
}

// Always-visible small numbered badge, distinct from Label (which only shows
// on select/hold). The number comes from the part's index in machine.parts —
// no separate numbering data, machine.parts stays the one source of truth.
function Marker({ number, active }: { number: number; active: boolean }) {
  return <Html center distanceFactor={7} style={{ pointerEvents: "none" }}><div className={`part-marker ${active ? "part-marker-active" : ""}`}>{active ? "✓" : String(number).padStart(2, "0")}</div></Html>;
}

function ClickPart({ id, active, onSelect, onRelease, children, position = [0, 0, 0] as [number, number, number], rotation = [0, 0, 0] as [number, number, number], partNumbers }: {
  id: string;
  active?: boolean;
  onSelect: (id: string) => void;
  onRelease?: () => void;
  children?: ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
  partNumbers?: Record<string, number>;
}) {
  const number = partNumbers?.[id];
  // Pointer-down shows the label immediately (so a genuine hold stays visible
  // in real time); pointer-up/out/cancel hands off to the 2s auto-hide timer
  // that lives in MachineLab. A quick tap therefore shows then fades; a held
  // press stays lit the whole time the finger/mouse is down.
  return (
    <group
      position={position}
      rotation={rotation}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(id); }}
      onPointerUp={(e) => { e.stopPropagation(); onRelease?.(); }}
      onPointerOut={() => onRelease?.()}
      onPointerCancel={() => onRelease?.()}
    >
      {children}
      {number !== undefined && <Marker number={number} active={!!active} />}
    </group>
  );
}

function Metal({ active = false, color = "#66727f", metalness = 0.6, roughness = 0.35 }: { active?: boolean; color?: string; metalness?: number; roughness?: number }) {
  return <meshStandardMaterial color={active ? "#4fc3d9" : color} metalness={metalness} roughness={roughness} emissive={active ? "#103b46" : "#000"} emissiveIntensity={active ? 0.8 : 0} />;
}

function RobotPiece({ index, position, visible = true, held = false }: { index: number; position: [number, number, number]; visible?: boolean; held?: boolean }) {
  if (!visible) return null;
  const mat = index === 0 ? "#aeb8bf" : index === 1 ? "#b87543" : "#6d7882";
  return <group position={position} scale={held ? 0.95 : 1}><mesh castShadow><boxGeometry args={index === 1 ? [0.35, 0.7, 0.35] : [0.65, 0.55, 0.65]} /><meshStandardMaterial color={mat} metalness={0.65} roughness={0.3} /></mesh>{index === 1 && <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.21, 0.06, 12, 24]} /><meshStandardMaterial color="#d9a061" metalness={0.45} /></mesh>}</group>;
}

// Real Sketchfab model (CC-BY-4.0, Makke). Static backdrop only — the arm
// itself stays our own animated procedural geometry, unchanged, because the
// source file has no rig/skeleton and the arm is the part that must actually
// move for pick-and-place to teach anything. This model covers the base,
// shoulder-joint housing, controller, and fence — the parts that don't move.
// First-pass scale/position, not visually verified yet.
function RobotModel() {
  const { scene } = useGLTF("/models/robotic-manipulator.glb");
  return <primitive object={scene} scale={1} position={[-0.13, 1.74, -0.665]} />;
}
useGLTF.preload("/models/robotic-manipulator.glb");

function RobotScene({ state, onPartSelect, onPartRelease, partNumbers }: Props) {
  const shoulder = useRef<THREE.Group>(null);
  const elbow = useRef<THREE.Group>(null);
  const wrist = useRef<THREE.Group>(null);
  const grip = useRef<THREE.Group>(null);
  const piecePositions: [number, number, number][] = [[-1.8, 0.35, 1.0], [-0.8, 0.45, 1.0], [0.2, 0.38, 1.0]];
  const selected = piecePositions[state.selectedWorkpiece] ?? piecePositions[0];
  const tray: [number, number, number] = [2.2, 0.42, 0.9];

  const motionPoint = (t: number) => {
    const p = THREE.MathUtils.clamp(t, 0, 1);
    if (state.robotTask === "pick") {
      if (p < 0.28) return new THREE.Vector3().lerpVectors(new THREE.Vector3(0.9, 2.6, 0), new THREE.Vector3(selected[0], 2.25, selected[2]), p / 0.28);
      if (p < 0.58) return new THREE.Vector3().lerpVectors(new THREE.Vector3(selected[0], 2.25, selected[2]), new THREE.Vector3(selected[0], selected[1] + 0.35, selected[2]), (p - 0.28) / 0.3);
      return new THREE.Vector3(selected[0], selected[1] + 0.35, selected[2]);
    }
    if (state.robotTask === "place") {
      if (p < 0.2) return new THREE.Vector3(selected[0], selected[1] + 0.35, selected[2]).lerp(new THREE.Vector3(selected[0], 2.4, selected[2]), p / 0.2);
      if (p < 0.72) return new THREE.Vector3().lerpVectors(new THREE.Vector3(selected[0], 2.4, selected[2]), new THREE.Vector3(tray[0], 2.2, tray[2]), (p - 0.2) / 0.52);
      return new THREE.Vector3().lerpVectors(new THREE.Vector3(tray[0], 2.2, tray[2]), new THREE.Vector3(tray[0], tray[1] + 0.35, tray[2]), (p - 0.72) / 0.28);
    }
    return state.robotHeld ? new THREE.Vector3(selected[0], selected[1] + 0.35, selected[2]) : new THREE.Vector3(0.9, 2.6, 0);
  };

  useFrame((_, dt) => {
    const point = motionPoint(state.robotTask === "idle" ? 1 : state.robotProgress);
    const angle = Math.atan2(point.z, point.x);
    const moving = state.robotTask !== "idle" || state.robotHeld;
    const shoulderTarget = moving ? angle - 0.05 : -0.35;
    const reach = Math.sqrt(point.x * point.x + point.z * point.z);
    const elbowTarget = moving ? THREE.MathUtils.clamp(1.15 - reach * 0.18 + (2.6 - point.y) * 0.25, -0.45, 1.15) : 0.75;
    const wristTarget = moving ? THREE.MathUtils.clamp((point.y - 1.5) * 0.2, -0.3, 0.35) : 0;
    if (shoulder.current) shoulder.current.rotation.y = THREE.MathUtils.damp(shoulder.current.rotation.y, shoulderTarget, 5, dt);
    if (elbow.current) elbow.current.rotation.z = THREE.MathUtils.damp(elbow.current.rotation.z, elbowTarget, 5, dt);
    if (wrist.current) wrist.current.rotation.z = THREE.MathUtils.damp(wrist.current.rotation.z, wristTarget, 5, dt);
    if (grip.current) grip.current.position.y = THREE.MathUtils.damp(grip.current.position.y, point.y - 1.5, 5, dt);
  });

  const heldPosition = motionPoint(state.robotTask === "idle" ? 1 : state.robotProgress);
  return <group position={[0, -1.1, 0]}>
    <Suspense fallback={<Html center><div className="viewer-loading">Loading robot model…</div></Html>}><RobotModel /></Suspense>
    <ClickPart id="base" active={state.selectedPart === "base"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0, 0.1, 0]}><mesh castShadow><cylinderGeometry args={[0.9, 1.0, 0.35, 32]} /><Invisible /></mesh><Label name="Robot base" position={[0, 0.45, 0]} active={state.selectedPart === "base"} /></ClickPart>
    <ClickPart id="j1" active={state.selectedPart === "j1"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0, 0.45, 0]}><mesh><cylinderGeometry args={[0.42, 0.42, 0.7, 24]} /><Invisible /></mesh><Label name="Shoulder joint" position={[0, 0.55, 0]} active={state.selectedPart === "j1"} /></ClickPart>
    <group ref={shoulder} position={[0, 0.75, 0]}><ClickPart id="upper" active={state.selectedPart === "upper"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0.75, 0.85, 0]} rotation={[0, 0, -0.35]}><mesh castShadow><boxGeometry args={[1.7, 0.35, 0.42]} /><Metal active={state.selectedPart === "upper"} /></mesh><Label name="Upper arm" position={[0.2, 0.35, 0]} active={state.selectedPart === "upper"} /></ClickPart><group ref={elbow} position={[1.55, 1.0, 0]}><ClickPart id="j2" active={state.selectedPart === "j2"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers}><mesh><sphereGeometry args={[0.3, 20, 20]} /><Metal active={state.selectedPart === "j2"} /></mesh><Label name="Elbow joint" position={[0, 0.45, 0]} active={state.selectedPart === "j2"} /></ClickPart><ClickPart id="forearm" active={state.selectedPart === "forearm"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0.7, -0.1, 0]} rotation={[0, 0, -0.25]}><mesh castShadow><boxGeometry args={[1.45, 0.28, 0.35]} /><Metal active={state.selectedPart === "forearm"} color="#75818b" /></mesh><Label name="Forearm" position={[0.2, 0.35, 0]} active={state.selectedPart === "forearm"} /></ClickPart><group ref={wrist} position={[1.35, -0.18, 0]}><ClickPart id="wrist" active={state.selectedPart === "wrist"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers}><mesh><cylinderGeometry args={[0.22, 0.22, 0.45, 20]} /><Metal active={state.selectedPart === "wrist"} /></mesh><Label name="Wrist" position={[0, 0.4, 0]} active={state.selectedPart === "wrist"} /></ClickPart><ClickPart id="gripper" active={state.selectedPart === "gripper"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0.32, -0.05, 0]}><group ref={grip}><mesh position={[0, -0.08, 0]}><boxGeometry args={[0.5, 0.16, 0.16]} /><Metal color="#a2abb2" /></mesh><mesh position={[0.18, -0.25, 0]}><boxGeometry args={[0.08, 0.35, 0.16]} /><Metal color="#a2abb2" /></mesh><mesh position={[-0.18, -0.25, 0]}><boxGeometry args={[0.08, 0.35, 0.16]} /><Metal color="#a2abb2" /></mesh><Label name="Two-finger gripper" position={[0, 0.45, 0]} active={state.selectedPart === "gripper"} /></group></ClickPart></group></group></group>
    <mesh position={[2.2, 0.22, 0.9]} castShadow><boxGeometry args={[1.6, 0.18, 1.1]} /><meshStandardMaterial color="#38454f" metalness={0.5} /></mesh><Label name="Target tray" position={[2.2, 0.55, 0.9]} active={false} />
    {state.picked.map((done, i) => <RobotPiece key={i} index={i} position={[2.2 + (i - 1) * 0.42, 0.43, 0.9]} visible={done && !((state.robotTask === "place") && i === state.selectedWorkpiece)} />)}
    {state.robotHeld && <RobotPiece index={state.selectedWorkpiece} position={[heldPosition.x, heldPosition.y - 0.1, heldPosition.z]} />}
    {piecePositions.map((pos, i) => <RobotPiece key={`source-${i}`} index={i} position={pos} visible={!state.picked[i] && !(state.robotHeld && i === state.selectedWorkpiece)} />)}
    <ClickPart id="controller" active={state.selectedPart === "controller"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[-2.5, 0.65, -0.4]}><mesh castShadow><boxGeometry args={[0.75, 1.2, 0.55]} /><Invisible /></mesh><Label name="Robot controller" position={[0, 0.75, 0]} active={state.selectedPart === "controller"} /></ClickPart>
    <ClickPart id="fence" active={state.selectedPart === "fence"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0, 1.05, -2.2]}><mesh><boxGeometry args={[5.8, 1.7, 0.06]} /><meshStandardMaterial color="#c8a34c" transparent opacity={0.06} /></mesh><Label name="Safety fence / gate" position={[0, 1.0, 0]} active={state.selectedPart === "fence"} /></ClickPart>
  </group>;
}

const MILL_STOCK = [
  { size: [0.9, 0.55, 0.9] as [number, number, number], color: "#8f979e" },
  { size: [1.0, 0.48, 0.8] as [number, number, number], color: "#d0d6d9" },
  { size: [0.82, 0.62, 0.82] as [number, number, number], color: "#c69c49" },
];

function MilledStock({ index, progress, mounted }: { index: number; progress: number; mounted: boolean }) {
  const stock = MILL_STOCK[index] ?? MILL_STOCK[0];
  if (!mounted) return <mesh position={[0, 1.5, 0]} castShadow><boxGeometry args={stock.size} /><meshStandardMaterial color={stock.color} metalness={0.65} roughness={0.3} /></mesh>;
  const cut = Math.min(stock.size[0] * 0.62, Math.max(0.02, progress * stock.size[0] * 0.62));
  const left = (stock.size[0] - cut) / 2;
  return <group position={[0, 0.82, 0]}>
    <mesh position={[-(cut + left) / 2, 0.02, 0]} castShadow><boxGeometry args={[left, stock.size[1], stock.size[2]]} /><meshStandardMaterial color={stock.color} metalness={0.65} roughness={0.3} /></mesh>
    <mesh position={[(cut + left) / 2, 0.02, 0]} castShadow><boxGeometry args={[left, stock.size[1], stock.size[2]]} /><meshStandardMaterial color={stock.color} metalness={0.65} roughness={0.3} /></mesh>
    <mesh position={[0, 0.04, 0]} castShadow><boxGeometry args={[cut, Math.max(0.06, stock.size[1] - 0.12), stock.size[2]]} /><meshStandardMaterial color="#6f797f" metalness={0.75} roughness={0.24} /></mesh>
  </group>;
}

// Real Sketchfab model (CC-BY-4.0, vramstudio). The vice's "Moving Jaw" and
// "Handle" are confirmed exact node names (that sub-assembly is a purchased
// library component with clean English names, unlike the machine's own
// custom parts). The spindle/quill is reached by structural position instead
// of name, because its name is unrecoverably corrupted in the source file
// (replaced with Unicode "invalid character" markers, not just non-English -
// there is nothing to look up). Movement direction/magnitude on both is a
// first estimate pending visual confirmation; which node moves is confirmed
// for the jaw, reasoned-but-unconfirmed for the spindle.
function MillModel({ state }: { state: MachineVisualState }) {
  const { scene, nodes } = useGLTF("/models/vertical-milling-machine.glb");
  const movingJaw = nodes["Moving Jaw"] as THREE.Object3D | undefined;
  const jawRest = useRef<number | null>(null);

  const spindleRef = useRef<THREE.Object3D | null>(null);
  const spindleRest = useRef<number | null>(null);
  useEffect(() => {
    let obj: THREE.Object3D = scene;
    for (const i of [0, 0, 0, 0, 0, 0, 0, 40]) {
      if (!obj.children[i]) { obj = scene; break; }
      obj = obj.children[i];
    }
    spindleRef.current = obj !== scene ? obj : null;
  }, [scene]);

  useFrame((_, dt) => {
    if (movingJaw) {
      if (jawRest.current === null) jawRest.current = movingJaw.position.z;
      const target = jawRest.current + (state.millingMounted ? -20 : 0);
      movingJaw.position.z = THREE.MathUtils.damp(movingJaw.position.z, target, 6, dt);
    }
    if (spindleRef.current) {
      if (spindleRest.current === null) spindleRest.current = spindleRef.current.position.y;
      const feedOffset = state.millingFeed ? -Math.min(60, state.millingProgress * 60) : 0;
      spindleRef.current.position.y = THREE.MathUtils.damp(spindleRef.current.position.y, spindleRest.current + feedOffset, 7, dt);
    }
  });

  return <primitive object={scene} scale={0.003} position={[0, 0, 0]} />;
}
useGLTF.preload("/models/vertical-milling-machine.glb");

function MillingScene({ state, onPartSelect, onPartRelease, partNumbers }: Props) {
  const cutter = useRef<THREE.Group>(null);
  const tableX = state.millingFeed ? -0.65 + state.millingProgress * 1.3 : 0;
  useFrame((_, dt) => {
    if (!cutter.current) return;
    const x = state.millingFeed ? -0.65 + state.millingProgress * 1.3 : 0;
    const y = state.millingFeed ? 2.05 - Math.min(0.12, state.millingProgress * 0.12) : 2.35;
    cutter.current.position.x = THREE.MathUtils.damp(cutter.current.position.x, x, 7, dt);
    cutter.current.position.y = THREE.MathUtils.damp(cutter.current.position.y, y, 7, dt);
  });
  const stock = MILL_STOCK[state.selectedWorkpiece] ?? MILL_STOCK[0];
  return <group position={[0, -1.2, 0]}>
    <Suspense fallback={<Html center><div className="viewer-loading">Loading mill model…</div></Html>}><MillModel state={state} /></Suspense>
    <ClickPart id="base" active={state.selectedPart === "base"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0, 0.0, 0]}><mesh castShadow><boxGeometry args={[4.8, 0.55, 2.6]} /><Invisible /></mesh><Label name="Machine base" position={[0, 0.42, 0]} active={state.selectedPart === "base"} /></ClickPart>
    <ClickPart id="column" active={state.selectedPart === "column"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0.85, 2.25, -0.15]}><mesh castShadow><boxGeometry args={[1.0, 4.5, 1.0]} /><Invisible /></mesh><Label name="Column" position={[0, 2.35, 0]} active={state.selectedPart === "column"} /></ClickPart>
    <ClickPart id="head" active={state.selectedPart === "head"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0.2, 4.25, 0]}><mesh castShadow><boxGeometry args={[2.5, 0.75, 1.3]} /><Invisible /></mesh><Label name="Milling head" position={[0, 0.55, 0]} active={state.selectedPart === "head"} /></ClickPart>
    <ClickPart id="spindle" active={state.selectedPart === "spindle"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[-0.35, 3.45, 0]}><mesh rotation={[0, 0, 0]}><cylinderGeometry args={[0.24, 0.24, 1.1, 24]} /><Invisible /></mesh><Label name="Spindle" position={[0, 0.65, 0]} active={state.selectedPart === "spindle"} /></ClickPart>
    <group ref={cutter} position={[0, 2.35, 0]}><ClickPart id="quill" active={state.selectedPart === "quill"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers}><mesh><cylinderGeometry args={[0.18, 0.18, 0.8, 20]} /><Metal active={state.selectedPart === "quill"} color="#8f989e" /></mesh><Label name="Quill" position={[0, 0.55, 0]} active={state.selectedPart === "quill"} /></ClickPart><ClickPart id="cutter" active={state.selectedPart === "cutter"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0, -0.65, 0]}><mesh><cylinderGeometry args={[0.12, 0.12, 0.7, 20]} /><meshStandardMaterial color={state.millingSpindle ? "#d8a34f" : "#c7cdd0"} metalness={0.85} roughness={0.2} /></mesh><Label name="End mill" position={[0, -0.48, 0]} active={state.selectedPart === "cutter"} /></ClickPart></group>
    <ClickPart id="table" active={state.selectedPart === "table"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[tableX, 1.0, 0]}><mesh castShadow><boxGeometry args={[4.0, 0.35, 1.8]} /><Metal active={state.selectedPart === "table"} color="#59656e" /></mesh><Label name="Machine table" position={[0, 0.35, 0]} active={state.selectedPart === "table"} /></ClickPart>
    <ClickPart id="vice" active={state.selectedPart === "vice"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[tableX, 1.42, 0]}><mesh castShadow><boxGeometry args={[1.85, 0.28, 1.25]} /><Invisible /></mesh><ClickPart id="fixed-jaw" active={state.selectedPart === "fixed-jaw"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[-0.62, 0.36, 0]}><mesh><boxGeometry args={[0.16, 0.55, 1.05]} /><Invisible /></mesh><Label name="Fixed jaw" position={[0, 0.55, 0]} active={state.selectedPart === "fixed-jaw"} /></ClickPart><ClickPart id="moving-jaw" active={state.selectedPart === "moving-jaw"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[state.millingMounted ? 0.48 : 0.78, 0.36, 0]}><mesh><boxGeometry args={[0.16, 0.55, 1.05]} /><Invisible /></mesh><Label name="Moving jaw" position={[0, 0.55, 0]} active={state.selectedPart === "moving-jaw"} /></ClickPart><ClickPart id="handle" active={state.selectedPart === "handle"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0.95, 0.2, 0]} rotation={[0, Math.PI / 2, 0]}><mesh><cylinderGeometry args={[0.06, 0.06, 0.8, 12]} /><Invisible /></mesh><Label name="Vice handle" position={[0.45, 0.25, 0]} active={state.selectedPart === "handle"} /></ClickPart><MilledStock index={state.selectedWorkpiece} progress={state.millingProgress} mounted={state.millingMounted} /></ClickPart>
    {state.millingFeed && <mesh position={[tableX, 1.0, 0.55]}><boxGeometry args={[0.9, 0.03, 0.08]} /><meshStandardMaterial color="#d5a34e" metalness={0.7} /></mesh>}
  </group>;
}

// Real Sketchfab model (CC-BY-4.0, bluoppVR) used as the static visual body.
// Scale/position are a first-pass estimate from the file's raw bounding box —
// not verified by eye yet, since this environment can't render 3D output.
// Expect to adjust these numbers once you've actually seen it on screen.
function PressModel() {
  const { scene } = useGLTF("/models/electric-hydro-press.glb");
  return <primitive object={scene} scale={1} position={[0, 1.65, -6]} />;
}
useGLTF.preload("/models/electric-hydro-press.glb");

function PressWorkpiece({ index, progress }: { index: number; progress: number }) {
  const compression = THREE.MathUtils.lerp(1, index === 0 ? 0.58 : index === 1 ? 0.7 : 0.68, progress);
  if (index === 1) return <group scale={[1, compression, 1]}><mesh position={[0, 0.08, 0]}><boxGeometry args={[0.95, 0.16, 0.62]} /><meshStandardMaterial color="#a5adb2" metalness={0.55} /></mesh><mesh position={[-0.4, 0.28, 0]}><boxGeometry args={[0.14, 0.5, 0.62]} /><meshStandardMaterial color="#a5adb2" metalness={0.55} /></mesh><mesh position={[0.4, 0.28, 0]}><boxGeometry args={[0.14, 0.5, 0.62]} /><meshStandardMaterial color="#a5adb2" metalness={0.55} /></mesh></group>;
  if (index === 2) return <mesh scale={[1, compression, 1]} castShadow><cylinderGeometry args={[0.32, 0.32, 0.55, 28]} /><meshStandardMaterial color="#c88e45" metalness={0.7} /></mesh>;
  return <mesh scale={[1, compression, 1]} castShadow><boxGeometry args={[1.05, 0.13, 0.72]} /><meshStandardMaterial color="#c9cdd0" metalness={0.55} /></mesh>;
}

function Invisible() {
  return <meshBasicMaterial transparent opacity={0} depthWrite={false} />;
}

function PressScene({ state, onPartSelect, onPartRelease, partNumbers }: Props) {
  const ramY = THREE.MathUtils.lerp(2.7, 1.25, state.pressActive ? state.pressProgress : 0);
  const finished = state.pressCycleComplete ? 1 : state.pressProgress;
  return <group position={[0, -1.2, 0]}>
    <Suspense fallback={<Html center><div className="viewer-loading">Loading press model…</div></Html>}><PressModel /></Suspense>
    <ClickPart id="frame" active={state.selectedPart === "frame"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers}><mesh position={[0, 2.2, 0]}><boxGeometry args={[3.2, 0.25, 1.5]} /><Invisible /></mesh><mesh position={[-2.65, 1.0, 0]}><boxGeometry args={[0.28, 2.0, 0.55]} /><Invisible /></mesh><mesh position={[2.65, 1.0, 0]}><boxGeometry args={[0.28, 2.0, 0.55]} /><Invisible /></mesh><Label name="Press frame" position={[0, 2.55, 0]} active={state.selectedPart === "frame"} /></ClickPart>
    <ClickPart id="cylinder" active={state.selectedPart === "cylinder"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0, 3.0, 0]}><mesh><cylinderGeometry args={[0.58, 0.65, 1.1, 24]} /><Invisible /></mesh><Label name="Hydraulic cylinder" position={[0, 0.8, 0]} active={state.selectedPart === "cylinder"} /></ClickPart>
    <ClickPart id="ram" active={state.selectedPart === "ram"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0, ramY, 0]}><mesh><boxGeometry args={[0.75, 1.1, 0.75]} /><Metal active={state.selectedPart === "ram"} color="#8b969e" /></mesh><Label name="Ram" position={[0, 0.65, 0]} active={state.selectedPart === "ram"} /></ClickPart>
    <ClickPart id="upper-die" active={state.selectedPart === "upper-die"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0, ramY - 0.72, 0]}><mesh><boxGeometry args={[1.2, 0.3, 1.2]} /><Metal active={state.selectedPart === "upper-die"} color="#b0b7bc" /></mesh><Label name="Upper die / punch" position={[0, -0.28, 0]} active={state.selectedPart === "upper-die"} /></ClickPart>
    <ClickPart id="bed" active={state.selectedPart === "bed"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0, 0.45, 0]}><mesh><boxGeometry args={[4.0, 0.35, 1.55]} /><Invisible /></mesh><Label name="Die bed" position={[0, 0.4, 0]} active={state.selectedPart === "bed"} /></ClickPart>
    <ClickPart id="lower-die" active={state.selectedPart === "lower-die"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0, 0.7, 0]}><mesh><boxGeometry args={[1.5, 0.2, 1.0]} /><Invisible /></mesh><Label name="Lower die" position={[0, 0.35, 0]} active={state.selectedPart === "lower-die"} /></ClickPart>
    {state.pressMounted ? <group position={[0, 0.95, 0]}><PressWorkpiece index={state.selectedWorkpiece} progress={finished} /></group> : <group position={[0, 1.55, 1.65]}><PressWorkpiece index={state.selectedWorkpiece} progress={0} /></group>}
    <ClickPart id="power-unit" active={state.selectedPart === "power-unit"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[-3.5, 0.2, 1.25]}><mesh><boxGeometry args={[0.8, 1.2, 0.6]} /><Invisible /></mesh><Label name="Hydraulic power unit" position={[0, 0.75, 0]} active={state.selectedPart === "power-unit"} /></ClickPart>
    <ClickPart id="gauge" active={state.selectedPart === "gauge"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[3.5, 0.45, 1.25]}><mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.4, 0.4, 0.12, 24]} /><Invisible /></mesh><Label name={`Pressure gauge ${state.pressPowered ? "· " + Math.round(state.pressActive ? pressureNeedle(state.pressProgress) : 0) + "%" : "· OFF"}`} position={[0, 0.48, 0]} active={state.selectedPart === "gauge"} /></ClickPart>
    <ClickPart id="left-button" active={state.selectedPart === "left-button"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[-3.2, 0.2, 2.0]}><mesh><cylinderGeometry args={[0.22, 0.22, 0.2, 20]} /><Invisible /></mesh><Label name="LEFT two-hand button" position={[0, 0.35, 0]} active={state.selectedPart === "left-button"} /></ClickPart>
    <ClickPart id="right-button" active={state.selectedPart === "right-button"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[3.2, 0.2, 2.0]}><mesh><cylinderGeometry args={[0.22, 0.22, 0.2, 20]} /><Invisible /></mesh><Label name="RIGHT two-hand button" position={[0, 0.35, 0]} active={state.selectedPart === "right-button"} /></ClickPart>
    <ClickPart id="guard" active={state.selectedPart === "guard"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0, 1.35, -0.9]}><mesh><boxGeometry args={[4.8, 1.4, 0.08]} /><meshStandardMaterial color="#d4b24f" transparent opacity={state.pressGuardClosed ? 0.05 : 0.16} /></mesh><Label name="Point-of-operation guard" position={[0, 2.1, 0]} active={state.selectedPart === "guard"} /></ClickPart>
  </group>;
}

function pressureNeedle(progress: number) { return Math.round(Math.min(100, progress * 100)); }

function PrintedPart({ index, layerFraction }: { index: number; layerFraction: number }) {
  const h = Math.max(0.03, layerFraction);
  if (index === 1) return <group scale={[1, h, 1]}><mesh><cylinderGeometry args={[0.58, 0.58, 0.2, 12]} /><meshStandardMaterial color="#d6dde0" roughness={0.8} /></mesh><mesh><torusGeometry args={[0.62, 0.07, 8, 12]} /><meshStandardMaterial color="#d6dde0" roughness={0.8} /></mesh><mesh position={[0.38, 0, 0]}><boxGeometry args={[0.18, 0.24, 0.2]} /><meshStandardMaterial color="#d6dde0" roughness={0.8} /></mesh></group>;
  if (index === 2) return <group scale={[1, h, 1]}><mesh position={[-0.3, 0.25, 0]}><boxGeometry args={[0.35, 0.9, 0.5]} /><meshStandardMaterial color="#d6dde0" roughness={0.8} /></mesh><mesh position={[0.15, -0.2, 0]}><boxGeometry args={[0.9, 0.2, 0.5]} /><meshStandardMaterial color="#d6dde0" roughness={0.8} /></mesh></group>;
  return <mesh scale={[1, h, 1]}><boxGeometry args={[1.0, 0.2, 1.0]} /><meshStandardMaterial color="#d6dde0" roughness={0.8} /></mesh>;
}

// Real Sketchfab model (CC-BY-4.0, 3D Distributed). The carriage/toolhead
// candidate is reached by structural position, not name — this file has no
// clean-named library components like the mill's vice did. This candidate is
// a reasoned geometric guess (compact block near the X midline, unlike the
// long thin rails around it) - NOT confirmed by name, unlike the mill's jaw.
function PrinterModel({ headTarget }: { headTarget: MutableRefObject<{ x: number; z: number }> }) {
  const { scene } = useGLTF("/models/workhorse-3d-printer.glb");
  const carriageRef = useRef<THREE.Object3D | null>(null);
  const rest = useRef<{ x: number; z: number } | null>(null);
  useEffect(() => {
    let obj: THREE.Object3D = scene;
    for (const i of [0, 0, 5]) {
      if (!obj.children[i]) { obj = scene; break; }
      obj = obj.children[i];
    }
    carriageRef.current = obj !== scene ? obj : null;
  }, [scene]);
  useFrame((_, dt) => {
    if (!carriageRef.current) return;
    if (rest.current === null) rest.current = { x: carriageRef.current.position.x, z: carriageRef.current.position.z };
    const SCALE = 1 / 0.003; // convert our scene-space toolpath offset into this model's own (larger, mm-scale) local units
    const targetX = rest.current.x + headTarget.current.x * SCALE;
    const targetZ = rest.current.z + headTarget.current.z * SCALE;
    carriageRef.current.position.x = THREE.MathUtils.damp(carriageRef.current.position.x, targetX, 9, dt);
    carriageRef.current.position.z = THREE.MathUtils.damp(carriageRef.current.position.z, targetZ, 9, dt);
  });
  return <primitive object={scene} scale={0.003} position={[0, 0, 0]} />;
}
useGLTF.preload("/models/workhorse-3d-printer.glb");

function PrinterScene({ state, onPartSelect, onPartRelease, partNumbers }: Props) {
  const head = useRef<THREE.Group>(null);
  const headTarget = useRef({ x: 0, z: 0 });
  const path = useMemo<[number, number, number][]>(() => {
    const p: [number, number, number][] = [];
    if (state.printerWorkpiece === 1) {
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        const r = 0.62 + 0.13 * Math.cos(8 * a);
        p.push([Math.cos(a) * r, 0, Math.sin(a) * r]);
      }
    } else if (state.printerWorkpiece === 2) {
      const outline: [number, number][] = [[-0.75,-0.65],[-0.1,-0.65],[-0.1,-0.2],[0.65,-0.2],[0.65,0.65],[-0.75,0.65],[-0.75,-0.65]];
      outline.forEach(([x,z]) => p.push([x,0,z]));
    } else {
      const outline: [number, number][] = [[-0.75,-0.65],[0.75,-0.65],[0.75,0.65],[-0.75,0.65],[-0.75,-0.65]];
      outline.forEach(([x,z]) => p.push([x,0,z]));
    }
    return p;
  }, [state.printerWorkpiece]);
  useFrame((_, dt) => {
    if (!head.current || !state.printerPrinting || path.length === 0) return;
    const idx = Math.min(path.length - 1, Math.floor((state.printerProgress % 1) * (path.length - 1)));
    const [x, , z] = path[idx];
    head.current.position.x = THREE.MathUtils.damp(head.current.position.x, x, 9, dt);
    head.current.position.z = THREE.MathUtils.damp(head.current.position.z, z, 9, dt);
    headTarget.current = { x: head.current.position.x, z: head.current.position.z };
  });
  const layers = Math.min(18, Math.floor(state.printerProgress * 18));
  return <group position={[0, -1.1, 0]}>
    <Suspense fallback={<Html center><div className="viewer-loading">Loading printer model…</div></Html>}><PrinterModel headTarget={headTarget} /></Suspense>
    <ClickPart id="frame" active={state.selectedPart === "frame"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0, 1.8, 0]}><mesh><boxGeometry args={[2.8, 0.18, 2.2]} /><Invisible /></mesh><mesh position={[-2.5, -0.9, 0]}><boxGeometry args={[0.18, 1.9, 0.18]} /><Invisible /></mesh><mesh position={[2.5, -0.9, 0]}><boxGeometry args={[0.18, 1.9, 0.18]} /><Invisible /></mesh><Label name="Printer frame" position={[0, 0.45, 0]} active={state.selectedPart === "frame"} /></ClickPart>
    <ClickPart id="bed" active={state.selectedPart === "bed"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0, 0.25, 0]}><mesh><boxGeometry args={[4.7, 0.3, 3.4]} /><Invisible /></mesh><mesh position={[0, 0.22, 0]}><boxGeometry args={[3.2, 0.12, 2.2]} /><Invisible /></mesh><Label name="Build plate" position={[0, 0.6, 0]} active={state.selectedPart === "bed"} /></ClickPart>
    <ClickPart id="x-axis" active={state.selectedPart === "x-axis"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0, 2.05, 0]}><mesh><boxGeometry args={[4.2, 0.16, 0.16]} /><Invisible /></mesh><Label name="X-axis rail" position={[0, 0.32, 0]} active={state.selectedPart === "x-axis"} /></ClickPart>
    <ClickPart id="carriage" active={state.selectedPart === "carriage"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers}><group ref={head} position={[0, 0.9, 0]}><mesh><boxGeometry args={[0.7, 0.35, 0.55]} /><Metal active={state.selectedPart === "carriage"} color="#4b5862" /></mesh><Label name="Print carriage" position={[0, 0.38, 0]} active={state.selectedPart === "carriage"} /></group></ClickPart>
    <ClickPart id="hotend" active={state.selectedPart === "hotend"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0, 0.45, 0]}><mesh><cylinderGeometry args={[0.16, 0.1, 0.45, 20]} /><meshStandardMaterial color={state.printerHeated ? "#e85b38" : "#6f7b84"} emissive={state.printerHeated ? "#5c1c0d" : "#000"} emissiveIntensity={state.printerHeated ? 0.6 : 0} transparent opacity={0.55} /></mesh><Label name="Hotend / nozzle" position={[0, 0.45, 0]} active={state.selectedPart === "hotend"} /></ClickPart>
    <ClickPart id="extruder" active={state.selectedPart === "extruder"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[-0.45, 1.15, 0]}><mesh><boxGeometry args={[0.45, 0.45, 0.45]} /><Invisible /></mesh><Label name="Extruder" position={[0, 0.4, 0]} active={state.selectedPart === "extruder"} /></ClickPart>
    <ClickPart id="spool" active={state.selectedPart === "spool"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[-1.9, 1.0, 1.0]}><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.55, 0.16, 16, 32]} /><Invisible /></mesh><Label name="Filament spool" position={[0, 0.75, 0]} active={state.selectedPart === "spool"} /></ClickPart>
    {state.printerFilamentLoaded && <mesh position={[-1.3, 1.0, 0.65]} rotation={[0, 0, 0.2]}><cylinderGeometry args={[0.025, 0.025, 1.9, 8]} /><meshStandardMaterial color="#d97b4f" /></mesh>}
    <ClickPart id="display" active={state.selectedPart === "display"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[2.05, 0.85, 1.0]}><mesh><boxGeometry args={[0.5, 0.8, 0.12]} /><Invisible /></mesh><Label name="Control display" position={[0, 0.55, 0]} active={state.selectedPart === "display"} /></ClickPart>
    <ClickPart id="y-axis" active={state.selectedPart === "y-axis"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[0, 0.95, -1.55]}><mesh><boxGeometry args={[3.2, 0.12, 0.12]} /><Invisible /></mesh><Label name="Y-axis motion" position={[0, 0.35, 0]} active={state.selectedPart === "y-axis"} /></ClickPart>
    <ClickPart id="z-axis" active={state.selectedPart === "z-axis"} onSelect={onPartSelect} onRelease={onPartRelease} partNumbers={partNumbers} position={[2.5, 1.25, 0]}><mesh><cylinderGeometry args={[0.07, 0.07, 1.9, 16]} /><Invisible /></mesh><Label name="Z-axis lead screws" position={[0, 1.05, 0]} active={state.selectedPart === "z-axis"} /></ClickPart>
    <group position={[0, 0.62, 0]}><PrintedPart index={state.printerWorkpiece} layerFraction={state.printerJobLoaded ? Math.max(0.02, layers / 18) : 0} /></group>
    {state.printerPrinting && <mesh position={[head.current?.position.x ?? 0, 0.68 + layers * 0.02, head.current?.position.z ?? 0]}><sphereGeometry args={[0.045, 10, 10]} /><meshStandardMaterial color="#e5a64e" emissive="#5d3410" emissiveIntensity={0.5} /></mesh>}
  </group>;
}

function Scene({ machineSlug, state, onPartSelect, onPartRelease, partNumbers }: Props) {
  if (machineSlug === "robotic-manipulator") return <RobotScene machineSlug={machineSlug} state={state} onPartSelect={onPartSelect} onPartRelease={onPartRelease} partNumbers={partNumbers} />;
  if (machineSlug === "vertical-milling-machine") return <MillingScene machineSlug={machineSlug} state={state} onPartSelect={onPartSelect} onPartRelease={onPartRelease} partNumbers={partNumbers} />;
  if (machineSlug === "electric-hydro-press") return <PressScene machineSlug={machineSlug} state={state} onPartSelect={onPartSelect} onPartRelease={onPartRelease} partNumbers={partNumbers} />;
  return <PrinterScene machineSlug={machineSlug} state={state} onPartSelect={onPartSelect} onPartRelease={onPartRelease} partNumbers={partNumbers} />;
}

export default function MachineViewer({ machineSlug, state, onPartSelect, onPartRelease, resetToken, partNumbers }: Props) {
  const cam = CAMERA_CONFIG[machineSlug] ?? CAMERA_CONFIG["robotic-manipulator"];
  // Typed as `any` deliberately: drei's OrbitControls forwards a ref to the
  // real three.js OrbitControls instance, whose full type is much larger
  // than what we use here. A narrower hand-written interface (object/target/
  // update only) fails React's ref assignability check against that real
  // type even though it's runtime-correct - `any` sidesteps that mismatch
  // without changing any actual behavior below.
  const controlsRef = useRef<any>(null);
  useEffect(() => {
    // resetToken starts undefined and only ever increments from a button
    // click in MachineLab, so this intentionally does nothing on mount and
    // only fires on an actual "Reset View" click.
    if (resetToken === undefined) return;
    const controls = controlsRef.current;
    if (!controls) return;
    controls.object.position.set(...cam.position);
    controls.target.set(...cam.target);
    controls.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);
  return <ViewerErrorBoundary><Canvas camera={{ position: cam.position, fov: cam.fov }} shadows dpr={[1, 1.6]} onCreated={({ camera }) => camera.lookAt(...cam.target)}><color attach="background" args={["#080c12"]} /><ambientLight intensity={1.05} /><directionalLight position={[6, 10, 7]} intensity={2.1} castShadow /><directionalLight position={[-5, 4, -6]} intensity={0.7} /><Scene machineSlug={machineSlug} state={state} onPartSelect={onPartSelect} onPartRelease={onPartRelease} partNumbers={partNumbers} /><gridHelper args={[12, 24, "#26313a", "#131b23"]} position={[0, -1.55, 0]} /><OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.08} minDistance={cam.minDistance} maxDistance={cam.maxDistance} target={cam.target} /></Canvas></ViewerErrorBoundary>;
}
