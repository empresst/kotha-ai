"use client";

import { ContactShadows, Float, Sparkles } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Kotha's mascot, built in real time from simple shapes: a chubby penguin with a
 * call-centre headset and a green-and-red scarf. It follows the cursor, blinks, waves,
 * and while the Bangla caller is speaking its beak moves with the agent's real voice level.
 */

export type VoiceState = {
  level: number;
  phase: "idle" | "connecting" | "waiting" | "live" | "ended" | "error";
  /** true while the agent is talking (from LiveKit's agent state) */
  speaking: boolean;
  /** performance.now() until which the agent is "checking the schedule" (avatar looks down) */
  busyUntil?: number;
};

const INK = "#27304f";
const INK_DARK = "#1d2440";
const SNOW = "#fbfaf6";
const ORANGE = "#ffa23a";
const ORANGE_DARK = "#f08a1c";
const SCARF = "#17a35b";
const RED = "#e5483f";
const BLUSH = "#ff8fb1";
const AMBER = "#ffb02e";

const soft = (color: string, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  ({ color, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color("#ffffff"), ...extra });

function Penguin({ voice }: { voice: React.RefObject<VoiceState> }) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const lowerBeak = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group[]>([]);
  const pupils = useRef<THREE.Group[]>([]);
  const wings = useRef<THREE.Group[]>([]);
  const feet = useRef<THREE.Group[]>([]);
  const scarfTail = useRef<THREE.Group>(null);
  const micTip = useRef<THREE.MeshStandardMaterial>(null);
  const st = useRef({ level: 0, open: 0, blink: 0, nextBlink: 2.5, wave: 0, nextWave: 3, wasInCall: false });

  useFrame(({ clock, pointer }, dt) => {
    const t = clock.elapsedTime;
    const s = st.current;
    const v = voice.current;
    s.level = THREE.MathUtils.lerp(s.level, Math.min(1, (v?.level ?? 0) * 4), 0.4);
    const speaking = !!v?.speaking || s.level > 0.05;
    const inCall = v?.phase === "live";

    // Beak: syllable-like chatter while the agent talks, wider on louder audio.
    const chatter = speaking ? (0.5 + 0.5 * Math.sin(t * 17)) * (0.55 + 0.45 * Math.abs(Math.sin(t * 5.3))) : 0;
    const targetOpen = speaking ? 0.12 + chatter * 0.42 + s.level * 0.3 : 0.04;
    s.open = THREE.MathUtils.lerp(s.open, targetOpen, 0.45);
    if (lowerBeak.current) lowerBeak.current.rotation.x = s.open;

    // Wave hello every few seconds while idle, and once when a call connects.
    s.nextWave -= dt;
    if (inCall !== s.wasInCall) { s.wasInCall = inCall; if (inCall) s.wave = 1; }
    if (!inCall && s.nextWave <= 0) { s.wave = 1; s.nextWave = 4 + Math.random() * 3; }
    s.wave = Math.max(0, s.wave - dt * 0.6);
    const waving = s.wave > 0 ? Math.sin((1 - s.wave) * Math.PI) : 0;

    wings.current.forEach((w, i) => {
      if (!w) return;
      const side = i ? -1 : 1; // 0 = left flipper (viewer's left), 1 = right flipper
      let rz = side * (0.22 + Math.sin(t * 2.2 + i * 1.7) * 0.16); // little idle flaps
      if (speaking) rz += side * (0.3 + Math.abs(Math.sin(t * 7 + i * 1.3)) * 0.6); // flap while talking
      if (i === 1 && waving) rz = -(0.5 + waving * 2.2 + Math.sin(t * 14) * 0.35 * waving); // right flipper waves
      w.rotation.z = THREE.MathUtils.lerp(w.rotation.z, rz, 0.18);
    });

    feet.current.forEach((f, i) => {
      if (!f) return;
      const step = speaking ? Math.max(0, Math.sin(t * 6 + i * Math.PI)) * 0.35 : Math.max(0, Math.sin(t * 1.2 + i * Math.PI)) * 0.08;
      f.rotation.x = THREE.MathUtils.lerp(f.rotation.x, -step, 0.25);
    });

    if (head.current) {
      head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, pointer.x * 0.5, 0.06);
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, -pointer.y * 0.22 + (speaking ? Math.sin(t * 8) * 0.04 : 0), 0.1);
      const tilt = inCall && !speaking ? 0.14 : waving * 0.12;
      head.current.rotation.z = THREE.MathUtils.lerp(head.current.rotation.z, tilt + Math.sin(t * 0.8) * 0.03, 0.06);
    }
    if (scarfTail.current) scarfTail.current.rotation.z = 0.25 + Math.sin(t * 2.2) * (speaking ? 0.12 : 0.05);
    if (root.current) {
      root.current.position.y = speaking ? Math.abs(Math.sin(t * 6)) * 0.05 : Math.abs(Math.sin(t * 1.6)) * 0.02;
      const squash = 1 + (speaking ? Math.sin(t * 12) * 0.012 : 0);
      root.current.scale.set(1 / squash, squash, 1 / squash);
    }

    s.nextBlink -= dt;
    if (s.nextBlink <= 0) { s.blink = 1; s.nextBlink = 2 + Math.random() * 3; }
    s.blink = Math.max(0, s.blink - dt * 7);
    const lid = 1 - Math.sin(s.blink * Math.PI) * 0.92;
    eyes.current.forEach((e) => e && (e.scale.y = lid));
    pupils.current.forEach((p) => {
      if (!p) return;
      p.position.x = THREE.MathUtils.lerp(p.position.x, pointer.x * 0.04, 0.12);
      p.position.y = THREE.MathUtils.lerp(p.position.y, pointer.y * 0.035, 0.12);
    });
    if (micTip.current) micTip.current.emissiveIntensity = 0.5 + (speaking ? 2 + s.level * 5 : 0) + (inCall ? 0.6 : 0);
  });

  return (
    <group ref={root}>
      {/* chubby egg-shaped body with a white tummy */}
      <mesh castShadow position={[0, -1.1, 0]} scale={[0.86, 0.8, 0.8]}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhysicalMaterial {...soft(INK)} />
      </mesh>
      <mesh position={[0, -1.14, 0.34]} scale={[0.66, 0.64, 0.5]}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshPhysicalMaterial {...soft(SNOW, { clearcoat: 0.2 })} />
      </mesh>

      {/* scarf in Bangladesh green, with a red dot on the hanging end */}
      <mesh position={[0, -0.8, 0.02]} rotation={[Math.PI / 2 - 0.12, 0, 0]} scale={[1, 0.92, 1]}>
        <torusGeometry args={[0.74, 0.13, 16, 48]} />
        <meshPhysicalMaterial {...soft(SCARF, { clearcoat: 0.15, roughness: 0.7 })} />
      </mesh>
      <group ref={scarfTail} position={[0.32, -0.86, 0.74]} rotation={[0.2, 0, 0.25]}>
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.2, 0.42, 0.07]} />
          <meshPhysicalMaterial {...soft(SCARF, { clearcoat: 0.15, roughness: 0.7 })} />
        </mesh>
        <mesh position={[0, -0.24, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.02, 24]} />
          <meshStandardMaterial color={RED} roughness={0.6} />
        </mesh>
      </group>

      {/* flippers: pivot at the shoulder so they swing like arms */}
      {[-1, 1].map((side, i) => (
        <group key={side} ref={(g) => { if (g) wings.current[i] = g; }} position={[side * 0.74, -0.8, 0]}>
          <mesh castShadow position={[side * 0.08, -0.36, 0]} scale={[0.13, 0.44, 0.28]} rotation={[0, 0, side * 0.18]}>
            <sphereGeometry args={[1, 32, 32]} />
            <meshPhysicalMaterial {...soft(INK_DARK)} />
          </mesh>
        </group>
      ))}

      {/* orange feet: pivot at the hip so they can tap */}
      {[-1, 1].map((side, i) => (
        <group key={side} ref={(g) => { if (g) feet.current[i] = g; }} position={[side * 0.32, -1.76, 0.2]}>
          <mesh position={[0, -0.05, 0.16]} scale={[0.22, 0.08, 0.28]}>
            <sphereGeometry args={[1, 24, 24]} />
            <meshPhysicalMaterial {...soft(ORANGE)} />
          </mesh>
        </group>
      ))}

      {/* head */}
      <group ref={head} position={[0, 0.3, 0]}>
        <mesh castShadow scale={[1.08, 1, 1]}>
          <sphereGeometry args={[1.05, 64, 64]} />
          <meshPhysicalMaterial {...soft(INK)} />
        </mesh>
        {/* heart-shaped white face: two rounded lobes around the eyes and a chin */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.32, 0.04, 0.5]} scale={[0.6, 0.66, 0.53]}>
            <sphereGeometry args={[1, 48, 48]} />
            <meshPhysicalMaterial {...soft(SNOW, { clearcoat: 0.3 })} />
          </mesh>
        ))}
        <mesh position={[0, -0.3, 0.56]} scale={[0.72, 0.5, 0.5]}>
          <sphereGeometry args={[1, 48, 48]} />
          <meshPhysicalMaterial {...soft(SNOW, { clearcoat: 0.3 })} />
        </mesh>
        {/* little curly tuft on top */}
        <mesh position={[0.06, 1.12, 0.42]} rotation={[-0.5, 0, 0.5]}>
          <torusGeometry args={[0.1, 0.035, 12, 24, Math.PI * 1.4]} />
          <meshPhysicalMaterial {...soft(INK_DARK)} />
        </mesh>
        <mesh position={[0, 1.02, 0.4]} rotation={[-0.45, 0, -0.15]}>
          <capsuleGeometry args={[0.04, 0.16, 8, 16]} />
          <meshPhysicalMaterial {...soft(INK_DARK)} />
        </mesh>
        {/* big glossy eyes with sparkles */}
        {[-1, 1].map((side, i) => (
          <group key={side} position={[side * 0.34, 0.08, 1.0]}>
            <group ref={(g) => { if (g) eyes.current[i] = g; }}>
              <group ref={(g) => { if (g) pupils.current[i] = g; }}>
                <mesh scale={[0.85, 1.1, 0.5]}>
                  <sphereGeometry args={[0.2, 32, 32]} />
                  <meshStandardMaterial color={INK_DARK} roughness={0.08} metalness={0.1} />
                </mesh>
                <mesh position={[0.06, 0.08, 0.1]}><sphereGeometry args={[0.055, 16, 16]} /><meshBasicMaterial color="#ffffff" /></mesh>
                <mesh position={[-0.05, -0.08, 0.09]}><sphereGeometry args={[0.025, 12, 12]} /><meshBasicMaterial color="#ffffff" /></mesh>
              </group>
            </group>
          </group>
        ))}
        {/* rosy cheeks */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.56, -0.24, 0.9]} scale={[0.15, 0.1, 0.05]}>
            <sphereGeometry args={[1, 24, 24]} />
            <meshStandardMaterial color={BLUSH} transparent opacity={0.6} roughness={0.8} />
          </mesh>
        ))}
        {/* small beak; the lower half opens when the mascot talks */}
        <mesh position={[0, -0.18, 1.08]} rotation={[Math.PI / 2 - 0.2, 0, 0]} scale={[1.2, 1, 0.7]}>
          <coneGeometry args={[0.11, 0.22, 32]} />
          <meshPhysicalMaterial {...soft(ORANGE, { clearcoat: 0.9 })} />
        </mesh>
        <group ref={lowerBeak} position={[0, -0.24, 1.02]}>
          <mesh position={[0, -0.01, 0.07]} rotation={[Math.PI / 2 + 0.1, 0, 0]} scale={[1.1, 1, 0.5]}>
            <coneGeometry args={[0.09, 0.17, 32]} />
            <meshPhysicalMaterial {...soft(ORANGE_DARK)} />
          </mesh>
        </group>
        {/* headset */}
        <mesh position={[0, 0.05, 0]} scale={[1.08, 1, 1]}>
          <torusGeometry args={[1.08, 0.06, 16, 64, Math.PI]} />
          <meshStandardMaterial color="#3a4370" metalness={0.4} roughness={0.35} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 1.15, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.24, 0.24, 0.2, 32]} />
            <meshStandardMaterial color="#3a4370" metalness={0.3} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[-0.82, -0.42, 0.72]} rotation={[0.95, 0.9, 0.55]}>
          <cylinderGeometry args={[0.022, 0.022, 0.85, 8]} />
          <meshStandardMaterial color="#3a4370" />
        </mesh>
        <mesh position={[-0.42, -0.62, 1.0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial ref={micTip} color={AMBER} emissive={AMBER} emissiveIntensity={0.5} />
        </mesh>
      </group>
    </group>
  );
}

/** Rings that pulse around the mascot during a call (spin while connecting). */
function VoiceRings({ voice }: { voice: React.RefObject<VoiceState> }) {
  const group = useRef<THREE.Group>(null);
  const rings = useMemo(() => [0, 1, 2], []);
  useFrame(({ clock }) => {
    const v = voice.current;
    const g = group.current;
    if (!g || !v) return;
    const t = clock.elapsedTime;
    const active = v.phase === "live" || v.phase === "connecting" || v.phase === "waiting";
    g.children.forEach((child, i) => {
      const m = child as THREE.Mesh;
      const mat = m.material as THREE.MeshBasicMaterial;
      if (v.phase === "live") {
        const p = (t * 0.6 + i / 3) % 1;
        m.scale.setScalar(1.6 + p * 1.2 + v.level * 1.5);
        mat.opacity = (1 - p) * (0.15 + v.level * 1.2);
        m.rotation.z = 0;
      } else if (active) {
        m.scale.setScalar(1.8 + i * 0.25);
        m.rotation.z = t * (1.5 + i * 0.4) * (i % 2 ? -1 : 1);
        mat.opacity = 0.35;
      } else {
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0, 0.1);
      }
    });
  });
  return (
    <group ref={group} position={[0, -0.35, -0.6]}>
      {rings.map((i) => (
        <mesh key={i}>
          <torusGeometry args={[1, 0.012, 8, 96, i === 0 ? Math.PI * 2 : Math.PI * 1.3]} />
          <meshBasicMaterial color={AMBER} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export default function KothaMascot({ voice }: { voice: React.RefObject<VoiceState> }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 6.2], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      aria-label="Kotha the penguin, the Kotha AI mascot, in 3D"
    >
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#bcd0ff", "#1a1030", 0.6]} />
      <directionalLight position={[3, 4, 5]} intensity={2.2} castShadow />
      <pointLight position={[-4, 1, -2]} intensity={25} color="#ffb347" />
      <pointLight position={[3, -2, 3]} intensity={8} color="#7aa2ff" />
      <Float speed={1.6} rotationIntensity={0.12} floatIntensity={0.5}>
        <group position={[0, 0.35, 0]}>
          <Penguin voice={voice} />
          <VoiceRings voice={voice} />
        </group>
      </Float>
      <ContactShadows position={[0, -1.6, 0]} opacity={0.45} scale={6} blur={2.6} far={3} color="#000010" />
      <Sparkles count={40} scale={[6, 4, 3]} size={2.2} speed={0.3} color="#ffd58a" opacity={0.6} />
    </Canvas>
  );
}
