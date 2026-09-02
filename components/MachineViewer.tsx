"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, Html } from "@react-three/drei";
import * as THREE from "three";
import { ANIMATION_CLIPS, AnimationClipDef, NodeKeyframe } from "@/lib/animations";

interface MachineViewerProps {
  modelPath: string;
  highlightNodes?: string[];
  /** Clip id from lib/animations.ts to play once when it changes. */
  activeClipId?: string | null;
}

interface PlayState {
  clip: AnimationClipDef;
  startedAt: number;
  targets: { node: THREE.Object3D; kf: NodeKeyframe; baseValue: number }[];
  /** Set when NONE of the clip's keyframes resolved to a real node. */
  usesFallbackPulse: boolean;
}

function Model({ modelPath, highlightNodes = [], activeClipId }: MachineViewerProps) {
  const { scene } = useGLTF(modelPath);
  const groupRef = useRef<THREE.Group>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const play = useRef<PlayState | null>(null);
  const lastClipId = useRef<string | null>(null);

  useEffect(() => {
    setSceneReady(true);
  }, [cloned]);

  // Highlight matching mesh nodes for the current step. If nothing matches,
  // we don't fabricate a match — the model just shows no highlight, which is
  // the honest behavior when a step targets a part this asset can't name.
  useEffect(() => {
    cloned.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const isHighlighted = highlightNodes.some((n) =>
          obj.name.toLowerCase().includes(n.toLowerCase())
        );
        const mat = obj.material as THREE.MeshStandardMaterial;
        if (mat && "emissive" in mat) {
          mat.emissive = new THREE.Color(isHighlighted ? "#E8962B" : "#000000");
          mat.emissiveIntensity = isHighlighted ? 0.6 : 0;
        }
      }
    });
  }, [cloned, highlightNodes]);

  // Start/replay a clip when activeClipId changes.
  useEffect(() => {
    if (!activeClipId || activeClipId === lastClipId.current || !sceneReady) return;
    lastClipId.current = activeClipId;
    const clip = ANIMATION_CLIPS[activeClipId];
    if (!clip) return;

    const targets: PlayState["targets"] = [];
    for (const kf of clip.keyframes) {
      let found: THREE.Object3D | null = null;
      cloned.traverse((obj) => {
        if (!found && obj.name.toLowerCase().includes(kf.targetNodeSubstring.toLowerCase())) {
          found = obj;
        }
      });
      if (found) {
        targets.push({ node: found, kf, baseValue: kf.from });
      }
    }

    play.current = {
      clip,
      startedAt: performance.now(),
      targets,
      usesFallbackPulse: targets.length === 0,
    };
  }, [activeClipId, cloned, sceneReady]);

  useFrame(() => {
    const state = play.current;
    if (!state) return;
    const elapsed = performance.now() - state.startedAt;
    const halfDuration = state.clip.pingPong ? state.clip.durationMs / 2 : state.clip.durationMs;
    const inFirstHalf = elapsed <= halfDuration;
    const localElapsed = inFirstHalf ? elapsed : elapsed - halfDuration;
    const rawT = Math.min(1, localElapsed / halfDuration);
    const eased = (state.clip.easing ?? ((t: number) => t))(rawT);
    const goingForward = !state.clip.pingPong || inFirstHalf;
    const t = goingForward ? eased : 1 - eased;

    if (state.usesFallbackPulse) {
      // Whole-model pulse: gentle scale bounce, honest "something happened"
      // feedback with no claim about which mechanism moved.
      const pulseT = Math.min(1, elapsed / state.clip.durationMs);
      const scale = 1 + Math.sin(pulseT * Math.PI) * 0.03;
      groupRef.current?.scale.setScalar(scale);
    } else {
      for (const { node, kf } of state.targets) {
        const value = kf.from + (kf.to - kf.from) * t;
        if (kf.property === "position") {
          node.position[kf.axis] = value;
        } else {
          node.rotation[kf.axis] = value;
        }
      }
    }

    if (elapsed >= state.clip.durationMs) {
      play.current = null;
      groupRef.current?.scale.setScalar(1);
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  );
}

export default function MachineViewer({ modelPath, highlightNodes, activeClipId }: MachineViewerProps) {
  return (
    <div className="w-full h-full bg-[#0F1013]">
      <Canvas camera={{ position: [3, 2, 3], fov: 45 }} shadows>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
        <Suspense
          fallback={
            <Html center className="readout">
              Loading model…
            </Html>
          }
        >
          <Model modelPath={modelPath} highlightNodes={highlightNodes} activeClipId={activeClipId} />
          <Environment preset="warehouse" />
        </Suspense>
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        <gridHelper args={[10, 20, "#2A2E35", "#1B1E23"]} />
      </Canvas>
    </div>
  );
}
