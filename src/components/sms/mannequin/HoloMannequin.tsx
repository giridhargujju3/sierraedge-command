import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { BodyZone, BodyZoneId, SensorKey, SensorReading, Status } from "@/lib/sms/types";
import { statusHex, statusLabel } from "@/lib/sms/status";
import { GlbBody } from "./GlbBody";

const HUD = "#4fd8ff";

/* ------------------------------------------------------------------ lights */

function BasicLights() {
  return (
    <>
      <ambientLight intensity={0.6} color="#ffffff" />
      <directionalLight position={[3, 5, 4]} intensity={1.2} color="#ffffff" castShadow />
      <directionalLight position={[-2, 3, -2]} intensity={0.4} color="#e0e8f0" />
      <pointLight position={[0, 2, 3]} intensity={0.6} color="#ffffff" distance={8} />
    </>
  );
}

/* ------------------------------------------------------------ sensor nodes */

function SensorNode({
  sensor,
  active,
  onSelect,
}: {
  sensor: SensorReading;
  active: boolean;
  onSelect: () => void;
}) {
  const core = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const color = statusHex[sensor.status];
  const status = sensor.status;
  const position = sensor.position;
  const speed = status === "off" ? 0 : status === "crit" ? 2.2 : status === "warn" ? 1.4 : 0.75;

  useFrame(({ clock }) => {
    const e = clock.elapsedTime;
    const breathe = speed > 0 ? 1 + Math.sin(e * speed * 3) * 0.12 : 1;
    if (core.current) core.current.scale.setScalar((active ? 1.6 : hover ? 1.3 : 1) * breathe);
    if (ring.current) {
      const pulse = speed > 0 ? (e * speed) % 1 : 0;
      ring.current.scale.setScalar(1 + pulse * 1.5);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - pulse) * (active ? 0.7 : 0.35);
    }
  });

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
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
      <mesh ref={core}>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>

      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.04, 0.048, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <pointLight color={color} intensity={active ? 0.8 : 0.2} distance={0.6} />

      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(g) =>
            g.setFromPoints([
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(position[0] >= 0 ? 0.5 : -0.5, 0.12, 0.1),
            ])
          }
        />
        <lineBasicMaterial attach="material" color={color} transparent opacity={active ? 0.6 : 0.15} depthWrite={false} />
      </line>

      {hover || active ? (
        <Html center distanceFactor={2.6} position={[0, 0.14, 0]} zIndexRange={[20, 0]}>
          <div className="pointer-events-none w-36 rounded-md border border-primary/60 bg-popover/90 px-2 py-1 text-left shadow-[var(--glow-hud)] backdrop-blur">
            <div className="hud-micro truncate">{sensor.label}</div>
            <div className="hud-value text-sm" style={{ color }}>{sensor.display}</div>
            <div className="hud-micro" style={{ color }}>{statusLabel[sensor.status]}</div>
            <div className="hud-micro opacity-70">Sensor: {sensor.sensorId}</div>
          </div>
        </Html>
      ) : null}
    </group>
  );
}

/* ------------------------------------------------------------- environment */

function Platform() {
  return (
    <group position={[0, -0.005, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.0, 48]} />
        <meshStandardMaterial color="#1a1f2e" roughness={0.8} metalness={0.2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <ringGeometry args={[0.95, 1.0, 48]} />
        <meshBasicMaterial color={HUD} transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* --------------------------------------------------------------- fallback */

function FallbackBody() {
  return (
    <mesh position={[0, 0.9, 0]}>
      <capsuleGeometry args={[0.18, 1.1, 6, 16]} />
      <meshStandardMaterial color="#90a4ae" />
    </mesh>
  );
}

/* ----------------------------------------------------------------- camera */

function CameraRig({ resetKey }: { resetKey: number }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 1.05, 4.2);
    camera.updateProjectionMatrix();
  }, [camera, resetKey]);
  return null;
}

/* ------------------------------------------------------------------ scene */

function Scene({
  zones,
  sensors,
  selected,
  selectedSensor,
  onSelectSensor,
  autoRotate,
  resetKey,
}: {
  zones: BodyZone[];
  sensors: SensorReading[];
  selected: BodyZoneId | null;
  selectedSensor: SensorKey | null;
  onSelectSensor: (key: SensorKey | null) => void;
  autoRotate: boolean;
  resetKey: number;
}) {
  const scanRef = useRef(0);

  return (
    <>
      <BasicLights />

      <Suspense fallback={<FallbackBody />}>
        <GlbBody
          zones={zones}
          selected={selected}
          onScan={(y) => (scanRef.current = y)}
        />
      </Suspense>

      {sensors.map((s) => (
        <SensorNode
          key={s.key}
          sensor={s}
          active={selectedSensor === s.key}
          onSelect={() => onSelectSensor(selectedSensor === s.key ? null : s.key)}
        />
      ))}

      <Platform />

      <CameraRig resetKey={resetKey} />
      <OrbitControls
        enablePan={false}
        minDistance={1.8}
        maxDistance={4.6}
        target={[0, 0.95, 0]}
        maxPolarAngle={Math.PI / 1.85}
        autoRotate={autoRotate}
        autoRotateSpeed={0.7}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

export default function HoloMannequin({
  zones,
  sensors,
  selected,
  selectedSensor,
  onSelectSensor,
  autoRotate = false,
  resetKey = 0,
}: {
  zones: BodyZone[];
  sensors: SensorReading[];
  selected: BodyZoneId | null;
  selectedSensor: SensorKey | null;
  onSelectSensor: (key: SensorKey | null) => void;
  autoRotate?: boolean;
  resetKey?: number;
}) {
  const [lowPower, setLowPower] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const apply = () => setLowPower(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 1.05, 4.2], fov: 34 }}
      dpr={lowPower ? 1 : [1, 1.8]}
      gl={{ antialias: !lowPower, alpha: true }}
      shadows
      onPointerMissed={() => onSelectSensor(null)}
    >
      <Scene
        zones={zones}
        sensors={sensors}
        selected={selected}
        selectedSensor={selectedSensor}
        onSelectSensor={onSelectSensor}
        autoRotate={autoRotate}
        resetKey={resetKey}
      />
    </Canvas>
  );
}
