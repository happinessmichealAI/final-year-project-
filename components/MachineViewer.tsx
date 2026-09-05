"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Component, useMemo, useRef } from "react";
import type { ErrorInfo, ReactNode } from "react";
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

function ClickPart({ id, active, onSelect, children, position = [0, 0, 0] as [number, number, number], rotation = [0, 0, 0] as [number, number, number] }: {
  id: string;
  active?: boolean;
  onSelect: (id: string) => void;
  children?: ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  return <group position={position} rotation={rotation} onClick={(e) => { e.stopPropagation(); onSelect(id); }}>{children}</group>;
}

function Metal({ active = false, color = "#66727f", metalness = 0.6, roughness = 0.35 }: { active?: boolean; color?: string; metalness?: number; roughness?: number }) {
  return <meshStandardMaterial color={active ? "#4fc3d9" : color} metalness={metalness} roughness={roughness} emissive={active ? "#103b46" : "#000"} emissiveIntensity={active ? 0.8 : 0} />;
}

function RobotPiece({ index, position, visible = true, held = false }: { index: number; position: [number, number, number]; visible?: boolean; held?: boolean }) {
  if (!visible) return null;
  const mat = index === 0 ? "#aeb8bf" : index === 1 ? "#b87543" : "#6d7882";
  return <group position={position} scale={held ? 0.95 : 1}><mesh castShadow><boxGeometry args={index === 1 ? [0.35, 0.7, 0.35] : [0.65, 0.55, 0.65]} /><meshStandardMaterial color={mat} metalness={0.65} roughness={0.3} /></mesh>{index === 1 && <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.21, 0.06, 12, 24]} /><meshStandardMaterial color="#d9a061" metalness={0.45} /></mesh>}</group>;
}

function RobotScene({ state, onPartSelect }: Props) {
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
    <ClickPart id="base" active={state.selectedPart === "base"} onSelect={onPartSelect} position={[0, 0.1, 0]}><mesh castShadow><cylinderGeometry args={[0.9, 1.0, 0.35, 32]} /><Metal active={state.selectedPart === "base"} /></mesh><Label name="Robot base" position={[0, 0.45, 0]} active={state.selectedPart === "base"} /></ClickPart>
    <ClickPart id="j1" active={state.selectedPart === "j1"} onSelect={onPartSelect} position={[0, 0.45, 0]}><mesh><cylinderGeometry args={[0.42, 0.42, 0.7, 24]} /><Metal active={state.selectedPart === "j1"} color="#78848e" /></mesh><Label name="Shoulder joint" position={[0, 0.55, 0]} active={state.selectedPart === "j1"} /></ClickPart>
    <group ref={shoulder} position={[0, 0.75, 0]}><ClickPart id="upper" active={state.selectedPart === "upper"} onSelect={onPartSelect} position={[0.75, 0.85, 0]} rotation={[0, 0, -0.35]}><mesh castShadow><boxGeometry args={[1.7, 0.35, 0.42]} /><Metal active={state.selectedPart === "upper"} /></mesh><Label name="Upper arm" position={[0.2, 0.35, 0]} active={state.selectedPart === "upper"} /></ClickPart><group ref={elbow} position={[1.55, 1.0, 0]}><ClickPart id="j2" active={state.selectedPart === "j2"} onSelect={onPartSelect}><mesh><sphereGeometry args={[0.3, 20, 20]} /><Metal active={state.selectedPart === "j2"} /></mesh><Label name="Elbow joint" position={[0, 0.45, 0]} active={state.selectedPart === "j2"} /></ClickPart><ClickPart id="forearm" active={state.selectedPart === "forearm"} onSelect={onPartSelect} position={[0.7, -0.1, 0]} rotation={[0, 0, -0.25]}><mesh castShadow><boxGeometry args={[1.45, 0.28, 0.35]} /><Metal active={state.selectedPart === "forearm"} color="#75818b" /></mesh><Label name="Forearm" position={[0.2, 0.35, 0]} active={state.selectedPart === "forearm"} /></ClickPart><group ref={wrist} position={[1.35, -0.18, 0]}><ClickPart id="wrist" active={state.selectedPart === "wrist"} onSelect={onPartSelect}><mesh><cylinderGeometry args={[0.22, 0.22, 0.45, 20]} /><Metal active={state.selectedPart === "wrist"} /></mesh><Label name="Wrist" position={[0, 0.4, 0]} active={state.selectedPart === "wrist"} /></ClickPart><ClickPart id="gripper" active={state.selectedPart === "gripper"} onSelect={onPartSelect} position={[0.32, -0.05, 0]}><group ref={grip}><mesh position={[0, -0.08, 0]}><boxGeometry args={[0.5, 0.16, 0.16]} /><Metal color="#a2abb2" /></mesh><mesh position={[0.18, -0.25, 0]}><boxGeometry args={[0.08, 0.35, 0.16]} /><Metal color="#a2abb2" /></mesh><mesh position={[-0.18, -0.25, 0]}><boxGeometry args={[0.08, 0.35, 0.16]} /><Metal color="#a2abb2" /></mesh><Label name="Two-finger gripper" position={[0, 0.45, 0]} active={state.selectedPart === "gripper"} /></group></ClickPart></group></group></group>
    <mesh position={[2.2, 0.22, 0.9]} castShadow><boxGeometry args={[1.6, 0.18, 1.1]} /><meshStandardMaterial color="#38454f" metalness={0.5} /></mesh><Label name="Target tray" position={[2.2, 0.55, 0.9]} active={false} />
    {state.picked.map((done, i) => <RobotPiece key={i} index={i} position={[2.2 + (i - 1) * 0.42, 0.43, 0.9]} visible={done && !((state.robotTask === "place") && i === state.selectedWorkpiece)} />)}
    {state.robotHeld && <RobotPiece index={state.selectedWorkpiece} position={[heldPosition.x, heldPosition.y - 0.1, heldPosition.z]} />}
    {piecePositions.map((pos, i) => <RobotPiece key={`source-${i}`} index={i} position={pos} visible={!state.picked[i] && !(state.robotHeld && i === state.selectedWorkpiece)} />)}
    <ClickPart id="controller" active={state.selectedPart === "controller"} onSelect={onPartSelect} position={[-2.5, 0.65, -0.4]}><mesh castShadow><boxGeometry args={[0.75, 1.2, 0.55]} /><Metal active={state.selectedPart === "controller"} color="#26333d" /></mesh><Label name="Robot controller" position={[0, 0.75, 0]} active={state.selectedPart === "controller"} /></ClickPart>
    <ClickPart id="fence" active={state.selectedPart === "fence"} onSelect={onPartSelect} position={[0, 1.05, -2.2]}><mesh><boxGeometry args={[5.8, 1.7, 0.06]} /><meshStandardMaterial color="#c8a34c" transparent opacity={0.22} /></mesh><Label name="Safety fence / gate" position={[0, 1.0, 0]} active={state.selectedPart === "fence"} /></ClickPart>
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

function MillingScene({ state, onPartSelect }: Props) {
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
    <ClickPart id="base" active={state.selectedPart === "base"} onSelect={onPartSelect} position={[0, 0.0, 0]}><mesh castShadow><boxGeometry args={[4.8, 0.55, 2.6]} /><Metal active={state.selectedPart === "base"} color="#4c5862" /></mesh><Label name="Machine base" position={[0, 0.42, 0]} active={state.selectedPart === "base"} /></ClickPart>
    <ClickPart id="column" active={state.selectedPart === "column"} onSelect={onPartSelect} position={[0.85, 2.25, -0.15]}><mesh castShadow><boxGeometry args={[1.0, 4.5, 1.0]} /><Metal active={state.selectedPart === "column"} color="#59656e" /></mesh><Label name="Column" position={[0, 2.35, 0]} active={state.selectedPart === "column"} /></ClickPart>
    <ClickPart id="head" active={state.selectedPart === "head"} onSelect={onPartSelect} position={[0.2, 4.25, 0]}><mesh castShadow><boxGeometry args={[2.5, 0.75, 1.3]} /><Metal active={state.selectedPart === "head"} color="#64717a" /></mesh><Label name="Milling head" position={[0, 0.55, 0]} active={state.selectedPart === "head"} /></ClickPart>
    <ClickPart id="spindle" active={state.selectedPart === "spindle"} onSelect={onPartSelect} position={[-0.35, 3.45, 0]}><mesh rotation={[0, 0, 0]}><cylinderGeometry args={[0.24, 0.24, 1.1, 24]} /><Metal active={state.selectedPart === "spindle"} color="#87919a" /></mesh><Label name="Spindle" position={[0, 0.65, 0]} active={state.selectedPart === "spindle"} /></ClickPart>
    <group ref={cutter} position={[0, 2.35, 0]}><ClickPart id="quill" active={state.selectedPart === "quill"} onSelect={onPartSelect}><mesh><cylinderGeometry args={[0.18, 0.18, 0.8, 20]} /><Metal active={state.selectedPart === "quill"} color="#8f989e" /></mesh><Label name="Quill" position={[0, 0.55, 0]} active={state.selectedPart === "quill"} /></ClickPart><ClickPart id="cutter" active={state.selectedPart === "cutter"} onSelect={onPartSelect} position={[0, -0.65, 0]}><mesh><cylinderGeometry args={[0.12, 0.12, 0.7, 20]} /><meshStandardMaterial color={state.millingSpindle ? "#d8a34f" : "#c7cdd0"} metalness={0.85} roughness={0.2} /></mesh><Label name="End mill" position={[0, -0.48, 0]} active={state.selectedPart === "cutter"} /></ClickPart></group>
    <ClickPart id="table" active={state.selectedPart === "table"} onSelect={onPartSelect} position={[tableX, 1.0, 0]}><mesh castShadow><boxGeometry args={[4.0, 0.35, 1.8]} /><Metal active={state.selectedPart === "table"} color="#59656e" /></mesh><Label name="Machine table" position={[0, 0.35, 0]} active={state.selectedPart === "table"} /></ClickPart>
    <ClickPart id="vice" active={state.selectedPart === "vice"} onSelect={onPartSelect} position={[tableX, 1.42, 0]}><mesh castShadow><boxGeometry args={[1.85, 0.28, 1.25]} /><Metal active={state.selectedPart === "vice"} color="#36434d" /></mesh><ClickPart id="fixed-jaw" active={state.selectedPart === "fixed-jaw"} onSelect={onPartSelect} position={[-0.62, 0.36, 0]}><mesh><boxGeometry args={[0.16, 0.55, 1.05]} /><Metal active={state.selectedPart === "fixed-jaw"} color="#737e86" /></mesh><Label name="Fixed jaw" position={[0, 0.55, 0]} active={state.selectedPart === "fixed-jaw"} /></ClickPart><ClickPart id="moving-jaw" active={state.selectedPart === "moving-jaw"} onSelect={onPartSelect} position={[state.millingMounted ? 0.48 : 0.78, 0.36, 0]}><mesh><boxGeometry args={[0.16, 0.55, 1.05]} /><Metal active={state.selectedPart === "moving-jaw"} color="#737e86" /></mesh><Label name="Moving jaw" position={[0, 0.55, 0]} active={state.selectedPart === "moving-jaw"} /></ClickPart><ClickPart id="handle" active={state.selectedPart === "handle"} onSelect={onPartSelect} position={[0.95, 0.2, 0]} rotation={[0, Math.PI / 2, 0]}><mesh><cylinderGeometry args={[0.06, 0.06, 0.8, 12]} /><Metal active={state.selectedPart === "handle"} color="#aab2b8" /></mesh><Label name="Vice handle" position={[0.45, 0.25, 0]} active={state.selectedPart === "handle"} /></ClickPart><MilledStock index={state.selectedWorkpiece} progress={state.millingProgress} mounted={state.millingMounted} /></ClickPart>
    {state.millingFeed && <mesh position={[tableX, 1.0, 0.55]}><boxGeometry args={[0.9, 0.03, 0.08]} /><meshStandardMaterial color="#d5a34e" metalness={0.7} /></mesh>}
  </group>;
}

function PressWorkpiece({ index, progress }: { index: number; progress: number }) {
  const compression = THREE.MathUtils.lerp(1, index === 0 ? 0.58 : index === 1 ? 0.7 : 0.68, progress);
  if (index === 1) return <group scale={[1, compression, 1]}><mesh position={[0, 0.08, 0]}><boxGeometry args={[0.95, 0.16, 0.62]} /><meshStandardMaterial color="#a5adb2" metalness={0.55} /></mesh><mesh position={[-0.4, 0.28, 0]}><boxGeometry args={[0.14, 0.5, 0.62]} /><meshStandardMaterial color="#a5adb2" metalness={0.55} /></mesh><mesh position={[0.4, 0.28, 0]}><boxGeometry args={[0.14, 0.5, 0.62]} /><meshStandardMaterial color="#a5adb2" metalness={0.55} /></mesh></group>;
  if (index === 2) return <mesh scale={[1, compression, 1]} castShadow><cylinderGeometry args={[0.32, 0.32, 0.55, 28]} /><meshStandardMaterial color="#c88e45" metalness={0.7} /></mesh>;
  return <mesh scale={[1, compression, 1]} castShadow><boxGeometry args={[1.05, 0.13, 0.72]} /><meshStandardMaterial color="#c9cdd0" metalness={0.55} /></mesh>;
}

function PressScene({ state, onPartSelect }: Props) {
  const ramY = THREE.MathUtils.lerp(2.7, 1.25, state.pressActive ? state.pressProgress : 0);
  const finished = state.pressCycleComplete ? 1 : state.pressProgress;
  return <group position={[0, -1.2, 0]}>
    <ClickPart id="frame" active={state.selectedPart === "frame"} onSelect={onPartSelect}><mesh position={[0, 2.2, 0]}><boxGeometry args={[3.2, 0.25, 1.5]} /><Metal active={state.selectedPart === "frame"} color="#4d5962" /></mesh><mesh position={[-2.65, 1.0, 0]}><boxGeometry args={[0.28, 2.0, 0.55]} /><Metal active={state.selectedPart === "frame"} color="#4d5962" /></mesh><mesh position={[2.65, 1.0, 0]}><boxGeometry args={[0.28, 2.0, 0.55]} /><Metal active={state.selectedPart === "frame"} color="#4d5962" /></mesh><Label name="Press frame" position={[0, 2.55, 0]} active={state.selectedPart === "frame"} /></ClickPart>
    <ClickPart id="cylinder" active={state.selectedPart === "cylinder"} onSelect={onPartSelect} position={[0, 3.0, 0]}><mesh><cylinderGeometry args={[0.58, 0.65, 1.1, 24]} /><Metal active={state.selectedPart === "cylinder"} color="#697680" /></mesh><Label name="Hydraulic cylinder" position={[0, 0.8, 0]} active={state.selectedPart === "cylinder"} /></ClickPart>
    <ClickPart id="ram" active={state.selectedPart === "ram"} onSelect={onPartSelect} position={[0, ramY, 0]}><mesh><boxGeometry args={[0.75, 1.1, 0.75]} /><Metal active={state.selectedPart === "ram"} color="#8b969e" /></mesh><Label name="Ram" position={[0, 0.65, 0]} active={state.selectedPart === "ram"} /></ClickPart>
    <ClickPart id="upper-die" active={state.selectedPart === "upper-die"} onSelect={onPartSelect} position={[0, ramY - 0.72, 0]}><mesh><boxGeometry args={[1.2, 0.3, 1.2]} /><Metal active={state.selectedPart === "upper-die"} color="#b0b7bc" /></mesh><Label name="Upper die / punch" position={[0, -0.28, 0]} active={state.selectedPart === "upper-die"} /></ClickPart>
    <ClickPart id="bed" active={state.selectedPart === "bed"} onSelect={onPartSelect} position={[0, 0.45, 0]}><mesh><boxGeometry args={[4.0, 0.35, 1.55]} /><Metal active={state.selectedPart === "bed"} color="#505b64" /></mesh><Label name="Die bed" position={[0, 0.4, 0]} active={state.selectedPart === "bed"} /></ClickPart>
    <ClickPart id="lower-die" active={state.selectedPart === "lower-die"} onSelect={onPartSelect} position={[0, 0.7, 0]}><mesh><boxGeometry args={[1.5, 0.2, 1.0]} /><Metal active={state.selectedPart === "lower-die"} color="#3b454e" /></mesh><Label name="Lower die" position={[0, 0.35, 0]} active={state.selectedPart === "lower-die"} /></ClickPart>
    {state.pressMounted ? <group position={[0, 0.95, 0]}><PressWorkpiece index={state.selectedWorkpiece} progress={finished} /></group> : <group position={[0, 1.55, 1.65]}><PressWorkpiece index={state.selectedWorkpiece} progress={0} /></group>}
    <ClickPart id="power-unit" active={state.selectedPart === "power-unit"} onSelect={onPartSelect} position={[-3.5, 0.2, 1.25]}><mesh><boxGeometry args={[0.8, 1.2, 0.6]} /><Metal active={state.selectedPart === "power-unit"} color="#26323b" /></mesh><Label name="Hydraulic power unit" position={[0, 0.75, 0]} active={state.selectedPart === "power-unit"} /></ClickPart>
    <ClickPart id="gauge" active={state.selectedPart === "gauge"} onSelect={onPartSelect} position={[3.5, 0.45, 1.25]}><mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.4, 0.4, 0.12, 24]} /><meshStandardMaterial color="#d2b15d" metalness={0.6} /></mesh><Label name={`Pressure gauge ${state.pressPowered ? "· " + Math.round(state.pressActive ? pressureNeedle(state.pressProgress) : 0) + "%" : "· OFF"}`} position={[0, 0.48, 0]} active={state.selectedPart === "gauge"} /></ClickPart>
    <ClickPart id="left-button" active={state.selectedPart === "left-button"} onSelect={onPartSelect} position={[-3.2, 0.2, 2.0]}><mesh><cylinderGeometry args={[0.22, 0.22, 0.2, 20]} /><meshStandardMaterial color="#b43e3e" /></mesh><Label name="LEFT two-hand button" position={[0, 0.35, 0]} active={state.selectedPart === "left-button"} /></ClickPart>
    <ClickPart id="right-button" active={state.selectedPart === "right-button"} onSelect={onPartSelect} position={[3.2, 0.2, 2.0]}><mesh><cylinderGeometry args={[0.22, 0.22, 0.2, 20]} /><meshStandardMaterial color="#b43e3e" /></mesh><Label name="RIGHT two-hand button" position={[0, 0.35, 0]} active={state.selectedPart === "right-button"} /></ClickPart>
    <ClickPart id="guard" active={state.selectedPart === "guard"} onSelect={onPartSelect} position={[0, 1.35, -0.9]}><mesh><boxGeometry args={[4.8, 1.4, 0.08]} /><meshStandardMaterial color="#d4b24f" transparent opacity={state.pressGuardClosed ? 0.14 : 0.28} /></mesh><Label name="Point-of-operation guard" position={[0, 2.1, 0]} active={state.selectedPart === "guard"} /></ClickPart>
  </group>;
}

function pressureNeedle(progress: number) { return Math.round(Math.min(100, progress * 100)); }

function PrintedPart({ index, layerFraction }: { index: number; layerFraction: number }) {
  const h = Math.max(0.03, layerFraction);
  const material = <meshStandardMaterial color="#d6dde0" roughness={0.8} />;
  if (index === 1) return <group scale={[1, h, 1]}><mesh><cylinderGeometry args={[0.58, 0.58, 0.2, 12]} />{material}</mesh><mesh><torusGeometry args={[0.62, 0.07, 8, 12]} />{material}</mesh><mesh position={[0.38, 0, 0]}><boxGeometry args={[0.18, 0.24, 0.2]} />{material}</mesh></group>;
  if (index === 2) return <group scale={[1, h, 1]}><mesh position={[-0.3, 0.25, 0]}><boxGeometry args={[0.35, 0.9, 0.5]} />{material}</mesh><mesh position={[0.15, -0.2, 0]}><boxGeometry args={[0.9, 0.2, 0.5]} />{material}</mesh></group>;
  return <mesh scale={[1, h, 1]}><boxGeometry args={[1.0, 0.2, 1.0]} />{material}</mesh>;
}

function PrinterScene({ state, onPartSelect }: Props) {
  const head = useRef<THREE.Group>(null);
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
  });
  const layers = Math.min(18, Math.floor(state.printerProgress * 18));
  return <group position={[0, -1.1, 0]}>
    <ClickPart id="frame" active={state.selectedPart === "frame"} onSelect={onPartSelect} position={[0, 1.8, 0]}><mesh><boxGeometry args={[2.8, 0.18, 2.2]} /><Metal active={state.selectedPart === "frame"} color="#59656e" /></mesh><mesh position={[-2.5, -0.9, 0]}><boxGeometry args={[0.18, 1.9, 0.18]} /><Metal active={state.selectedPart === "frame"} color="#59656e" /></mesh><mesh position={[2.5, -0.9, 0]}><boxGeometry args={[0.18, 1.9, 0.18]} /><Metal active={state.selectedPart === "frame"} color="#59656e" /></mesh><Label name="Printer frame" position={[0, 0.45, 0]} active={state.selectedPart === "frame"} /></ClickPart>
    <ClickPart id="bed" active={state.selectedPart === "bed"} onSelect={onPartSelect} position={[0, 0.25, 0]}><mesh><boxGeometry args={[4.7, 0.3, 3.4]} /><Metal active={state.selectedPart === "bed"} color="#29343d" /></mesh><mesh position={[0, 0.22, 0]}><boxGeometry args={[3.2, 0.12, 2.2]} /><meshStandardMaterial color="#4c5963" /></mesh><Label name="Build plate" position={[0, 0.6, 0]} active={state.selectedPart === "bed"} /></ClickPart>
    <ClickPart id="x-axis" active={state.selectedPart === "x-axis"} onSelect={onPartSelect} position={[0, 2.05, 0]}><mesh><boxGeometry args={[4.2, 0.16, 0.16]} /><Metal active={state.selectedPart === "x-axis"} color="#7a858e" /></mesh><Label name="X-axis rail" position={[0, 0.32, 0]} active={state.selectedPart === "x-axis"} /></ClickPart>
    <ClickPart id="carriage" active={state.selectedPart === "carriage"} onSelect={onPartSelect}><group ref={head} position={[0, 0.9, 0]}><mesh><boxGeometry args={[0.7, 0.35, 0.55]} /><Metal active={state.selectedPart === "carriage"} color="#4b5862" /></mesh><Label name="Print carriage" position={[0, 0.38, 0]} active={state.selectedPart === "carriage"} /></group></ClickPart>
    <ClickPart id="hotend" active={state.selectedPart === "hotend"} onSelect={onPartSelect} position={[0, 0.45, 0]}><mesh><cylinderGeometry args={[0.16, 0.1, 0.45, 20]} /><meshStandardMaterial color={state.printerHeated ? "#e85b38" : "#6f7b84"} metalness={0.75} /></mesh><mesh position={[0, -0.28, 0]}><coneGeometry args={[0.08, 0.22, 20]} /><meshStandardMaterial color="#d4d8db" metalness={0.75} /></mesh><Label name="Hotend / nozzle" position={[0, 0.45, 0]} active={state.selectedPart === "hotend"} /></ClickPart>
    <ClickPart id="extruder" active={state.selectedPart === "extruder"} onSelect={onPartSelect} position={[-0.45, 1.15, 0]}><mesh><boxGeometry args={[0.45, 0.45, 0.45]} /><Metal active={state.selectedPart === "extruder"} color="#515e67" /></mesh><Label name="Extruder" position={[0, 0.4, 0]} active={state.selectedPart === "extruder"} /></ClickPart>
    <ClickPart id="spool" active={state.selectedPart === "spool"} onSelect={onPartSelect} position={[-1.9, 1.0, 1.0]}><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.55, 0.16, 16, 32]} /><meshStandardMaterial color="#b25c4b" /></mesh><Label name="Filament spool" position={[0, 0.75, 0]} active={state.selectedPart === "spool"} /></ClickPart>
    {state.printerFilamentLoaded && <mesh position={[-1.3, 1.0, 0.65]} rotation={[0, 0, 0.2]}><cylinderGeometry args={[0.025, 0.025, 1.9, 8]} /><meshStandardMaterial color="#d97b4f" /></mesh>}
    <ClickPart id="display" active={state.selectedPart === "display"} onSelect={onPartSelect} position={[2.05, 0.85, 1.0]}><mesh><boxGeometry args={[0.5, 0.8, 0.12]} /><meshStandardMaterial color="#18232c" /></mesh><Label name="Control display" position={[0, 0.55, 0]} active={state.selectedPart === "display"} /></ClickPart>
    <ClickPart id="y-axis" active={state.selectedPart === "y-axis"} onSelect={onPartSelect} position={[0, 0.95, -1.55]}><mesh><boxGeometry args={[3.2, 0.12, 0.12]} /><Metal active={state.selectedPart === "y-axis"} color="#7a858e" /></mesh><Label name="Y-axis motion" position={[0, 0.35, 0]} active={state.selectedPart === "y-axis"} /></ClickPart>
    <ClickPart id="z-axis" active={state.selectedPart === "z-axis"} onSelect={onPartSelect} position={[2.5, 1.25, 0]}><mesh><cylinderGeometry args={[0.07, 0.07, 1.9, 16]} /><Metal active={state.selectedPart === "z-axis"} color="#7a858e" /></mesh><Label name="Z-axis lead screws" position={[0, 1.05, 0]} active={state.selectedPart === "z-axis"} /></ClickPart>
    <group position={[0, 0.62, 0]}><PrintedPart index={state.printerWorkpiece} layerFraction={state.printerJobLoaded ? Math.max(0.02, layers / 18) : 0} /></group>
    {state.printerPrinting && <mesh position={[head.current?.position.x ?? 0, 0.68 + layers * 0.02, head.current?.position.z ?? 0]}><sphereGeometry args={[0.045, 10, 10]} /><meshStandardMaterial color="#e5a64e" emissive="#5d3410" emissiveIntensity={0.5} /></mesh>}
  </group>;
}

function Scene({ machineSlug, state, onPartSelect }: Props) {
  if (machineSlug === "robotic-manipulator") return <RobotScene machineSlug={machineSlug} state={state} onPartSelect={onPartSelect} />;
  if (machineSlug === "vertical-milling-machine") return <MillingScene machineSlug={machineSlug} state={state} onPartSelect={onPartSelect} />;
  if (machineSlug === "electric-hydro-press") return <PressScene machineSlug={machineSlug} state={state} onPartSelect={onPartSelect} />;
  return <PrinterScene machineSlug={machineSlug} state={state} onPartSelect={onPartSelect} />;
}

export default function MachineViewer({ machineSlug, state, onPartSelect }: Props) {
  const cam = CAMERA_CONFIG[machineSlug] ?? CAMERA_CONFIG["robotic-manipulator"];
  return <ViewerErrorBoundary><Canvas camera={{ position: cam.position, fov: cam.fov }} shadows dpr={[1, 1.6]} onCreated={({ camera }) => camera.lookAt(...cam.target)}><color attach="background" args={["#080c12"]} /><ambientLight intensity={1.05} /><directionalLight position={[6, 10, 7]} intensity={2.1} castShadow /><directionalLight position={[-5, 4, -6]} intensity={0.7} /><Scene machineSlug={machineSlug} state={state} onPartSelect={onPartSelect} /><gridHelper args={[12, 24, "#26313a", "#131b23"]} position={[0, -1.55, 0]} /><OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={cam.minDistance} maxDistance={cam.maxDistance} target={cam.target} /></Canvas></ViewerErrorBoundary>;
}
