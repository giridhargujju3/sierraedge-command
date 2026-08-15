import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { BodyZone, BodyZoneId, Status } from "@/lib/sms/types";
import { statusHex } from "@/lib/sms/status";

const HUD = "#38c6f4";

function HoloPart({
  args,
  position,
  rotation,
  color,
  geometry = "capsule",
}: {
  args: number[];
  position: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  geometry?: "capsule" | "sphere" | "box";
}) {
  return (
    <group position={position} rotation={rotation ?? [0, 0, 0]}>
      <mesh>
        {geometry === "capsule" ? (
          <capsuleGeometry args={[args[0], args[1], 8, 20]} />
        ) : geometry === "sphere" ? (
          <sphereGeometry args={[args[0], 24, 20]} />
        ) : (
          <boxGeometry args={[args[0], args[1], args[2]]} />
        )}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          transparent
          opacity={0.24}
          roughness={0.25}
          metalness={0.1}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.005}>
        {geometry === "capsule" ? (
          <capsuleGeometry args={[args[0], args[1], 4, 12]} />
        ) : geometry === "sphere" ? (
          <sphereGeometry args={[args[0], 14, 12]} />
        ) : (
          <boxGeometry args={[args[0], args[1], args[2]]} />
        )}
        <meshBasicMaterial color={color} wireframe transparent opacity={0.16} />
      </mesh>
    </group>
  );
}

function SensorPoint({
  position,
  status,
  active,
  onClick,
}: {
  position: [number, number, number];
  status: Status;
  active: boolean;
  onClick: () => void;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const color = statusHex[status];

  useFrame(({ clock }) => {
    if (!ring.current) return;
    const t = (clock.elapsedTime * 0.9) % 1;
    const s = 1 + t * 2.2;
    ring.current.scale.setScalar(s);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.6;
  });

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "auto";
      }}
    >
      <mesh scale={active || hover ? 1.6 : 1}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.045, 0.055, 24]} />
        <meshBasicMaterial color={color} transparent side={THREE.DoubleSide} />
      </mesh>
      <pointLight color={color} intensity={active ? 0.8 : 0.3} distance={0.6} />
    </group>
  );
}

function Platform() {
  const g = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (g.current) g.current.rotation.y += d * 0.25;
  });
  return (
    <group position={[0, 0.01, 0]}>
      <group ref={g}>
        {[0.55, 0.78, 1.02].map((r, i) => (
          <mesh key={r} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[r, r + 0.012, 64, 1, 0, Math.PI * (i === 1 ? 1.2 : 1.7)]} />
            <meshBasicMaterial color={HUD} transparent opacity={0.55 - i * 0.12} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.15, 64]} />
        <meshBasicMaterial color={HUD} transparent opacity={0.07} />
      </mesh>
    </group>
  );
}

function Body({
  zones,
  selected,
  onSelectZone,
}: {
  zones: BodyZone[];
  selected: BodyZoneId | null;
  onSelectZone: (id: BodyZoneId) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const zoneStatus = useMemo(() => {
    const map = {} as Record<BodyZoneId, Status>;
    zones.forEach((z) => (map[z.id] = z.status));
    return map;
  }, [zones]);

  useFrame(({ clock }) => {
    if (group.current) group.current.position.y = Math.sin(clock.elapsedTime * 0.8) * 0.015;
  });

  const tone = (id: BodyZoneId) => (zoneStatus[id] === "ok" ? HUD : statusHex[zoneStatus[id] ?? "ok"]);
  const hl = (id: BodyZoneId) => (selected === id ? "#ffffff" : tone(id));

  return (
    <group ref={group}>
      {/* head + neck */}
      <HoloPart geometry="sphere" args={[0.115]} position={[0, 1.62, 0]} color={hl("head")} />
      <HoloPart args={[0.045, 0.06]} position={[0, 1.49, 0]} color={hl("head")} />
      {/* torso */}
      <HoloPart args={[0.155, 0.28]} position={[0, 1.27, 0]} color={hl("upperBody")} />
      <HoloPart args={[0.135, 0.16]} position={[0, 1.0, 0]} color={hl("core")} />
      <HoloPart args={[0.145, 0.06]} position={[0, 0.87, 0]} color={hl("core")} />
      {/* shoulders */}
      <HoloPart geometry="sphere" args={[0.075]} position={[-0.185, 1.38, 0]} color={hl("arms")} />
      <HoloPart geometry="sphere" args={[0.075]} position={[0.185, 1.38, 0]} color={hl("arms")} />
      {/* arms */}
      <HoloPart args={[0.05, 0.22]} position={[-0.235, 1.2, 0]} rotation={[0, 0, 0.09]} color={hl("arms")} />
      <HoloPart args={[0.05, 0.22]} position={[0.235, 1.2, 0]} rotation={[0, 0, -0.09]} color={hl("arms")} />
      <HoloPart args={[0.042, 0.22]} position={[-0.27, 0.95, 0]} rotation={[0, 0, 0.06]} color={hl("arms")} />
      <HoloPart args={[0.042, 0.22]} position={[0.27, 0.95, 0]} rotation={[0, 0, -0.06]} color={hl("arms")} />
      <HoloPart geometry="sphere" args={[0.05]} position={[-0.285, 0.79, 0]} color={hl("arms")} />
      <HoloPart geometry="sphere" args={[0.05]} position={[0.285, 0.79, 0]} color={hl("arms")} />
      {/* legs */}
      <HoloPart args={[0.075, 0.3]} position={[-0.085, 0.62, 0]} color={hl("legs")} />
      <HoloPart args={[0.075, 0.3]} position={[0.085, 0.62, 0]} color={hl("legs")} />
      <HoloPart args={[0.06, 0.28]} position={[-0.085, 0.26, 0]} color={hl("legs")} />
      <HoloPart args={[0.06, 0.28]} position={[0.085, 0.26, 0]} color={hl("legs")} />
      <HoloPart geometry="box" args={[0.1, 0.05, 0.2]} position={[-0.085, 0.04, 0.04]} color={hl("legs")} />
      <HoloPart geometry="box" args={[0.1, 0.05, 0.2]} position={[0.085, 0.04, 0.04]} color={hl("legs")} />

      {zones.map((z) => (
        <SensorPoint
          key={z.id}
          position={z.position}
          status={z.status}
          active={selected === z.id}
          onClick={() => onSelectZone(z.id)}
        />
      ))}
    </group>
  );
}

export default function HoloMannequin({
  zones,
  selected,
  onSelectZone,
}: {
  zones: BodyZone[];
  selected: BodyZoneId | null;
  onSelectZone: (id: BodyZoneId) => void;
}) {
  return (
    <Canvas
      camera={{ position: [0, 1.25, 3.1], fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => onSelectZone("" as BodyZoneId)}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[2, 3, 3]} intensity={12} color={HUD} />
      <pointLight position={[-2, 1, -2]} intensity={8} color="#1e6fff" />
      <Body zones={zones} selected={selected} onSelectZone={onSelectZone} />
      <Platform />
      <OrbitControls
        enablePan={false}
        minDistance={1.8}
        maxDistance={4.5}
        target={[0, 0.95, 0]}
        maxPolarAngle={Math.PI / 1.85}
        autoRotate={false}
        enableDamping
      />
    </Canvas>
  );
}
