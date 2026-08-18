import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import type { BodyZone, BodyZoneId, SensorKey, SensorReading, Status } from "@/lib/sms/types";
import { statusHex, statusLabel } from "@/lib/sms/status";
import { GlbBody } from "./GlbBody";
import { ZONE_BANDS } from "./holoMaterial";

const HUD = "#4fd8ff";
const DEEP = "#1e6fff";

/* ------------------------------------------------------------------ lights */

function HoloLights() {
  return (
    <>
      <ambientLight intensity={0.25} />
      {/* strong cyan backlight — creates the glowing silhouette */}
      <pointLight position={[0, 1.35, -2.2]} intensity={40} color={HUD} distance={7} />
      <directionalLight position={[0, 2.4, -3]} intensity={3.2} color={DEEP} />
      {/* rim lights left / right behind the body */}
      <pointLight position={[-1.8, 1.5, -1.2]} intensity={14} color={HUD} distance={6} />
      <pointLight position={[1.8, 1.5, -1.2]} intensity={14} color={HUD} distance={6} />
      {/* soft front fill */}
      <pointLight position={[0, 1.4, 2.6]} intensity={5} color="#9fe8ff" distance={7} />
      {/* ground bounce under the feet */}
      <pointLight position={[0, 0.08, 0]} intensity={6} color={HUD} distance={2.2} />
    </>
  );
}

/** Internal body glow — makes the twin look technologically generated. */
function InternalGlow({ zones }: { zones: BodyZone[] }) {
  const chest = useRef<THREE.PointLight>(null);
  const status = (id: BodyZoneId) => zones.find((z) => z.id === id)?.status ?? "ok";
  const col = (id: BodyZoneId) => (status(id) === "ok" ? HUD : statusHex[status(id)]);

  useFrame(({ clock }) => {
    if (chest.current) chest.current.intensity = 2.2 + Math.sin(clock.elapsedTime * 4.2) * 1.1;
  });

  return (
    <>
      <pointLight position={[0, 1.62, 0]} intensity={1.1} color={col("head")} distance={0.6} />
      <pointLight ref={chest} position={[-0.04, 1.34, 0.02]} intensity={2.2} color={col("upperBody")} distance={0.8} />
      <pointLight position={[0, 1.05, 0]} intensity={1.4} color={col("core")} distance={0.8} />
      <pointLight position={[-0.3, 1.0, 0]} intensity={0.7} color={col("arms")} distance={0.5} />
      <pointLight position={[0.3, 1.0, 0]} intensity={0.7} color={col("arms")} distance={0.5} />
      <pointLight position={[0, 0.5, 0]} intensity={0.9} color={col("legs")} distance={0.7} />
    </>
  );
}

/* ------------------------------------------------------------- energy lines */

function EnergyLines({ scanY }: { scanY: number }) {
  const mat = useRef<THREE.LineBasicMaterial>(null);
  const geometry = useMemo(() => {
    const paths: THREE.Vector3[][] = [
      // spine
      [
        new THREE.Vector3(0, 0.92, -0.07),
        new THREE.Vector3(0, 1.2, -0.09),
        new THREE.Vector3(0, 1.45, -0.08),
        new THREE.Vector3(0, 1.56, -0.04),
      ],
      // shoulders
      [
        new THREE.Vector3(-0.2, 1.4, 0),
        new THREE.Vector3(0, 1.47, -0.02),
        new THREE.Vector3(0.2, 1.4, 0),
      ],
      // arms
      [new THREE.Vector3(-0.2, 1.4, 0), new THREE.Vector3(-0.3, 1.1, 0.02), new THREE.Vector3(-0.33, 0.82, 0.05)],
      [new THREE.Vector3(0.2, 1.4, 0), new THREE.Vector3(0.3, 1.1, 0.02), new THREE.Vector3(0.33, 0.82, 0.05)],
      // legs
      [new THREE.Vector3(-0.09, 0.92, 0), new THREE.Vector3(-0.1, 0.5, 0.02), new THREE.Vector3(-0.1, 0.08, 0.03)],
      [new THREE.Vector3(0.09, 0.92, 0), new THREE.Vector3(0.1, 0.5, 0.02), new THREE.Vector3(0.1, 0.08, 0.03)],
    ];
    const pts: THREE.Vector3[] = [];
    paths.forEach((p) => {
      const curve = new THREE.CatmullRomCurve3(p);
      const sampled = curve.getPoints(24);
      for (let i = 0; i < sampled.length - 1; i++) {
        pts.push(sampled[i]!, sampled[i + 1]!);
      }
    });
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (mat.current) mat.current.opacity = 0.16 + Math.sin(clock.elapsedTime * 1.7) * 0.05;
  });

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        ref={mat}
        color={HUD}
        transparent
        opacity={0.16}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

/* ------------------------------------------------------------- scan plane */

function ScanRing({ y }: { y: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) ref.current.position.y = y;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.02, 0.42, 48]} />
      <meshBasicMaterial
        color={HUD}
        transparent
        opacity={0.09}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------ sensor nodes */

function SensorNode({
  sensor,
  active,
  scanY,
  onSelect,
}: {
  sensor: SensorReading;
  active: boolean;
  scanY: number;
  onSelect: () => void;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const orbit = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const core = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const color = statusHex[sensor.status];
  const status = sensor.status;
  const position = sensor.position;

  // Pulse speed is driven by status: calm when nominal, urgent when critical.
  const speed = status === "off" ? 0 : status === "crit" ? 2.2 : status === "warn" ? 1.4 : 0.75;

  useFrame(({ clock }) => {
    const e = clock.elapsedTime;
    const boost = active ? 1.6 : 1;
    if (speed > 0) {
      const t = (e * speed * boost) % 1;
      if (ring.current) {
        ring.current.scale.setScalar(1 + t * (status === "crit" ? 3.2 : 2.4));
        (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * (active ? 0.9 : 0.6);
      }
      if (ring2.current) {
        const t2 = (t + 0.5) % 1;
        ring2.current.scale.setScalar(1 + t2 * 2.6);
        (ring2.current.material as THREE.MeshBasicMaterial).opacity =
          (1 - t2) * (status === "crit" ? 0.6 : 0.28);
      }
    }
    const near = Math.exp(-Math.pow((position[1] - scanY) * 14, 2));
    const breathe = speed > 0 ? 1 + Math.sin(e * speed * 3) * 0.12 : 1;
    if (core.current) core.current.scale.setScalar((active ? 1.9 : hover ? 1.5 : 1) * breathe);
    if (halo.current) {
      halo.current.scale.setScalar((active || hover ? 1.7 : 1.1) + near * 0.5);
      (halo.current.material as THREE.MeshBasicMaterial).opacity =
        (status === "off" ? 0.07 : 0.2) + near * 0.2 + (active ? 0.16 : 0);
    }
    if (orbit.current) orbit.current.rotation.z = e * (active ? 1.1 : 0.5);
    if (light.current) light.current.intensity = (active ? 1.4 : 0.4) * (status === "off" ? 0.2 : 1) + near * 0.4;
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
      {/* bright core */}
      <mesh ref={core}>
        <sphereGeometry args={[0.032, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={status === "off" ? 0.55 : 0.98} />
      </mesh>

      {/* soft halo */}
      <mesh ref={halo}>
        <sphereGeometry args={[0.07, 20, 20]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* static outer ring + subtle orbit ring */}
      <group ref={orbit}>
        <mesh rotation={[Math.PI / 2.6, 0, 0]}>
          <torusGeometry args={[0.062, 0.0035, 8, 40]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={status === "off" ? 0.2 : active ? 0.85 : 0.5}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* expanding pulse rings */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, 0.058, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={ring2} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, 0.054, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <pointLight ref={light} color={color} intensity={0.4} distance={0.8} />

      {/* connector line towards the label side */}
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
        <lineBasicMaterial
          attach="material"
          color={color}
          transparent
          opacity={active ? 0.6 : 0.14}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </line>

      {hover || active ? (
        <Html center distanceFactor={2.6} position={[0, 0.14, 0]} zIndexRange={[20, 0]}>
          <div className="pointer-events-none w-36 rounded-md border border-primary/60 bg-popover/90 px-2 py-1 text-left shadow-[var(--glow-hud)] backdrop-blur">
            <div className="hud-micro truncate">{sensor.label}</div>
            <div className="hud-value text-sm" style={{ color }}>
              {sensor.display}
            </div>
            <div className="hud-micro" style={{ color }}>
              {statusLabel[sensor.status]}
            </div>
            <div className="hud-micro opacity-70">Sensor: {sensor.sensorId}</div>
          </div>
        </Html>
      ) : null}
    </group>
  );
}

/* ------------------------------------------------------------- environment */

function Platform({ tint }: { tint: string }) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const segments = useMemo(() => [0, 1, 2, 3, 4, 5].map((i) => (i * Math.PI * 2) / 6), []);

  useFrame((_, d) => {
    if (outer.current) outer.current.rotation.y += d * 0.22;
    if (inner.current) inner.current.rotation.y -= d * 0.34;
  });

  return (
    <group position={[0, 0.005, 0]}>
      <group ref={outer}>
        {[0.86, 1.02].map((r, i) => (
          <mesh key={r} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[r, r + 0.01, 96, 1, 0, Math.PI * (i === 0 ? 1.5 : 0.7)]} />
            <meshBasicMaterial color={tint} transparent opacity={0.5 - i * 0.15} side={THREE.DoubleSide} />
          </mesh>
        ))}
        {segments.map((a) => (
          <mesh key={a} rotation={[-Math.PI / 2, 0, a]} position={[0, 0.001, 0]}>
            <ringGeometry args={[1.08, 1.11, 24, 1, 0, 0.28]} />
            <meshBasicMaterial color={tint} transparent opacity={0.45} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>

      <group ref={inner}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.52, 0.528, 96, 1, 0, Math.PI * 1.25]} />
          <meshBasicMaterial color={tint} transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
        {segments.map((a) => (
          <mesh key={a} rotation={[-Math.PI / 2, 0, a]}>
            <planeGeometry args={[0.34, 0.004]} />
            <meshBasicMaterial color={tint} transparent opacity={0.16} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>

      {/* soft light pool under the feet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.2, 64]} />
        <meshBasicMaterial
          color={tint}
          transparent
          opacity={0.08}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[0.42, 48]} />
        <meshBasicMaterial
          color={tint}
          transparent
          opacity={0.12}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/** Soft radial aura behind the body — a camera-facing additive disc. */
function BackAura() {
  const ref = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(90,215,255,0.55)");
    g.addColorStop(0.45, "rgba(40,140,220,0.20)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 0.7) * 0.02;
      ref.current.scale.set(3.2 * s, 3.6 * s, 1);
    }
  });

  return (
    <mesh ref={ref} position={[0, 1.0, -1.4]} scale={[3.2, 3.6, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.7}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function Particles({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const { geometry, seeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * 1.1;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.random() * 2.1;
      pos[i * 3 + 2] = Math.sin(a) * r;
      size[i] = 0.01 + Math.random() * 0.025;
      seeds[i] = Math.random() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("size", new THREE.BufferAttribute(size, 1));
    return { geometry: g, seeds };
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] = ((arr[i * 3 + 1]! + 0.0007 + Math.sin(t + seeds[i]!) * 0.0002) % 2.2 + 2.2) % 2.2;
    }
    attr.needsUpdate = true;
    if (ref.current) ref.current.rotation.y = t * 0.03;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        color={HUD}
        size={0.018}
        sizeAttenuation
        transparent
        opacity={0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* --------------------------------------------------------------- fallback */

function FallbackBody() {
  return (
    <mesh position={[0, 0.9, 0]}>
      <capsuleGeometry args={[0.18, 1.1, 6, 16]} />
      <meshBasicMaterial color={HUD} transparent opacity={0.08} wireframe />
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
  lowPower,
}: {
  zones: BodyZone[];
  sensors: SensorReading[];
  selected: BodyZoneId | null;
  selectedSensor: SensorKey | null;
  onSelectSensor: (key: SensorKey | null) => void;
  autoRotate: boolean;
  resetKey: number;
  lowPower: boolean;
}) {
  const scanRef = useRef(0);
  const [scanY, setScanY] = useState(0);

  // Throttle scan updates into React state (nodes read it per-frame via prop).
  useFrame(() => {
    if (Math.abs(scanRef.current - scanY) > 0.02) setScanY(scanRef.current);
  });

  const worstStatus: Status = zones.some((z) => z.status === "crit")
    ? "crit"
    : zones.some((z) => z.status === "warn")
      ? "warn"
      : zones.every((z) => z.status === "off")
        ? "off"
        : "ok";
  const tint = worstStatus === "ok" ? HUD : statusHex[worstStatus];

  return (
    <>
      <HoloLights />
      <BackAura />

      <Suspense fallback={<FallbackBody />}>
        <GlbBody
          zones={zones}
          selected={selected}
          quality={lowPower ? "low" : "high"}
          onScan={(y) => (scanRef.current = y)}
        />
      </Suspense>

      <InternalGlow zones={zones} />
      <EnergyLines scanY={scanY} />
      <ScanRing y={scanY} />

      {sensors.map((s) => (
        <SensorNode
          key={s.key}
          sensor={s}
          active={selectedSensor === s.key}
          scanY={scanY}
          onSelect={() => onSelectSensor(selectedSensor === s.key ? null : s.key)}
        />
      ))}

      <Platform tint={tint} />
      {!lowPower ? <Particles count={70} /> : <Particles count={26} />}

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

      <EffectComposer enabled={!lowPower}>
        <Bloom intensity={0.9} luminanceThreshold={0.25} luminanceSmoothing={0.35} mipmapBlur radius={0.7} />
      </EffectComposer>
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
      gl={{ antialias: !lowPower, alpha: true, powerPreference: "high-performance" }}
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
        lowPower={lowPower}
      />
    </Canvas>
  );
}

export { ZONE_BANDS };

