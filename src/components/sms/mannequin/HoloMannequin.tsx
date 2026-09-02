import { Suspense, useEffect, useMemo, useRef, useState, type ComponentRef, type Ref } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { BodyZone, BodyZoneId, SensorKey, SensorReading, Status } from "@/lib/sms/types";
import { statusHex, statusLabel } from "@/lib/sms/status";
import { GlbBody } from "./GlbBody";

const HUD = "#4fd8ff";

/** Ref type of the drei OrbitControls instance driving the stage camera. */
export type MannequinControls = NonNullable<ComponentRef<typeof OrbitControls>>;

/** Vertical pan limits (target height, metres) — the body stays reachable at any zoom. */
export const TARGET_MIN_Y = 0.25;
export const TARGET_MAX_Y = 1.9;

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
      (ring.current.material as THREE.MeshBasicMaterial).opacity =
        (1 - pulse) * (active ? 0.7 : 0.35);
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
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <pointLight color={color} intensity={active ? 0.8 : 0.2} distance={0.6} />

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

/* -------------------------------------------------------------- projector */

/** A model-space point tracked for the HUD overlay (zone anchors, sensor nodes). */
export interface ProjectPoint {
  id: string;
  pos: [number, number, number];
}

/** Screen-space callback: CSS-pixel coordinates within the canvas + facing flag. */
export type ProjectFn = (id: string, x: number, y: number, front: boolean) => void;

const _pt = new THREE.Vector3();
const _out = new THREE.Vector3();
const _toCam = new THREE.Vector3();

/**
 * Projects HUD anchor points to screen pixels every frame so the DOM overlay
 * (callout boxes + SVG connectors in MannequinStage) stays glued to the 3D
 * sensor nodes while orbiting / zooming / panning. `front` tells the overlay
 * whether the point is on the camera-facing side of the body axis.
 */
function AnchorProjector({
  points,
  onUpdate,
}: {
  points: ProjectPoint[];
  onUpdate?: ProjectFn | undefined;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const cb = useRef<ProjectFn | undefined>(undefined);
  cb.current = onUpdate;
  useFrame(() => {
    const fn = cb.current;
    if (!fn) return;
    for (const p of points) {
      _pt.set(p.pos[0], p.pos[1], p.pos[2]);
      /* Facing test — is the point on the camera-facing side of the body axis?
       * Points on the axis itself (x=z≈0) fall back to the camera z hemisphere. */
      _out.set(p.pos[0], 0, p.pos[2]);
      _toCam.copy(camera.position).sub(_pt);
      const front = _out.lengthSq() < 1e-8 ? _toCam.z > 0 : _out.dot(_toCam) > 0;
      _pt.project(camera);
      fn(p.id, (_pt.x * 0.5 + 0.5) * size.width, (-_pt.y * 0.5 + 0.5) * size.height, front);
    }
  });
  return null;
}

/* ----------------------------------------------------------------- camera */

export type CameraView = { p: [number, number, number]; t: [number, number, number] };

const FACTORY_POS: [number, number, number] = [0, 1.05, 4.2];
const FACTORY_TARGET: [number, number, number] = [0, 0.95, 0];

function CameraRig({
  resetKey,
  savedView,
}: {
  resetKey: number;
  savedView?: CameraView | undefined;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as {
    target?: THREE.Vector3;
    update?: () => void;
  } | null;

  /* Mount / controls attach → restore the operator's saved view (SAVE VIEW
   * button) or fall back to the factory default. */
  useEffect(() => {
    const [px, py, pz] = savedView ? savedView.p : FACTORY_POS;
    const [tx, ty, tz] = savedView ? savedView.t : FACTORY_TARGET;
    camera.position.set(px, py, pz);
    // The pan target must move with the camera or the view drifts back.
    if (controls?.target) {
      controls.target.set(tx, ty, tz);
      controls.update?.();
    }
    camera.updateProjectionMatrix();
  }, [camera, controls, savedView]);

  /* RESET button → factory default (skips the mount run). */
  const prevReset = useRef(resetKey);
  useEffect(() => {
    if (prevReset.current === resetKey) return;
    prevReset.current = resetKey;
    camera.position.set(FACTORY_POS[0], FACTORY_POS[1], FACTORY_POS[2]);
    // RESET must restore the pan target as well, not just the camera position.
    if (controls?.target) {
      controls.target.set(FACTORY_TARGET[0], FACTORY_TARGET[1], FACTORY_TARGET[2]);
      controls.update?.();
    }
    camera.updateProjectionMatrix();
  }, [resetKey, camera, controls]);
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
  controlsRef,
  onAnchors,
  savedView,
}: {
  zones: BodyZone[];
  sensors: SensorReading[];
  selected: BodyZoneId | null;
  selectedSensor: SensorKey | null;
  onSelectSensor: (key: SensorKey | null) => void;
  autoRotate: boolean;
  resetKey: number;
  controlsRef?: Ref<MannequinControls> | undefined;
  onAnchors?: ProjectFn | undefined;
  savedView?: CameraView | undefined;
}) {
  const scanRef = useRef(0);

  /* HUD anchor points (model space) projected to screen pixels every frame so
   * the DOM overlay can draw callout boxes + elbow connectors onto the live
   * sensor nodes — like a schematic holo rig around the soldier. */
  const anchorPoints = useMemo<ProjectPoint[]>(
    () => [
      ...zones.map((z): ProjectPoint => ({ id: `zone:${z.id}`, pos: z.position })),
      ...sensors.map((s): ProjectPoint => ({ id: `sensor:${s.key}`, pos: s.position })),
    ],
    [zones, sensors],
  );

  return (
    <>
      <BasicLights />

      <Suspense fallback={<FallbackBody />}>
        <GlbBody zones={zones} selected={selected} onScan={(y) => (scanRef.current = y)} />
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

      <AnchorProjector points={anchorPoints} onUpdate={onAnchors} />
      <CameraRig resetKey={resetKey} savedView={savedView} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan
        panSpeed={0.9}
        screenSpacePanning
        minDistance={1.15}
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
  controlsRef,
  onAnchors,
  savedView,
}: {
  zones: BodyZone[];
  sensors: SensorReading[];
  selected: BodyZoneId | null;
  selectedSensor: SensorKey | null;
  onSelectSensor: (key: SensorKey | null) => void;
  autoRotate?: boolean;
  resetKey?: number;
  controlsRef?: Ref<MannequinControls> | undefined;
  onAnchors?: ProjectFn | undefined;
  savedView?: CameraView | undefined;
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
        controlsRef={controlsRef}
        onAnchors={onAnchors}
        savedView={savedView}
      />
    </Canvas>
  );
}
