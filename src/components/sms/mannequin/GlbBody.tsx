import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BodyZone, BodyZoneId, Status } from "@/lib/sms/types";
import { statusHex } from "@/lib/sms/status";
import modelAsset from "@/assets/sierraedge-mannequin.glb.asset.json";
import { ZONE_BANDS, createAuraMaterial, createBodyMaterial, createWireMaterial } from "./holoMaterial";

const HUD = "#4fd8ff";
/** Target height in metres so uploaded models line up with the sensor anchors. */
const TARGET_HEIGHT = 1.75;
const SCAN_PERIOD = 7; // seconds top -> bottom

export function GlbBody({
  zones,
  selected,
  quality = "high",
  onScan,
}: {
  zones: BodyZone[];
  selected: BodyZoneId | null;
  quality?: "high" | "low";
  onScan?: (y: number) => void;
}) {
  const { scene } = useGLTF(modelAsset.url);
  const group = useRef<THREE.Group>(null);

  const worst: Status = zones.some((z) => z.status === "crit")
    ? "crit"
    : zones.some((z) => z.status === "warn")
      ? "warn"
      : "ok";
  const tint = worst === "ok" ? HUD : statusHex[worst];
  const selectedStatus = zones.find((z) => z.id === selected)?.status ?? "ok";
  const highlightHex = selected ? (selectedStatus === "ok" ? "#c9f7ff" : statusHex[selectedStatus]) : "#ffffff";

  const { model, scale, offset } = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const s = TARGET_HEIGHT / (size.y || 1);
    return {
      model: clone,
      scale: s,
      offset: new THREE.Vector3(-center.x * s, -box.min.y * s, -center.z * s),
    };
  }, [scene]);

  /** Build the three holographic layers: aura shell, fresnel body, wireframe. */
  const { bodyMats, auraMats, wireMats } = useMemo(() => {
    const bodyMats: THREE.ShaderMaterial[] = [];
    const auraMats: THREE.ShaderMaterial[] = [];
    const wireMats: THREE.MeshBasicMaterial[] = [];

    // Collect first: adding children during traverse() would recurse forever.
    const meshes: THREE.Mesh[] = [];
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && !mesh.userData['holoLayer']) meshes.push(mesh);
    });

    meshes.forEach((mesh) => {
      const body = createBodyMaterial();
      mesh.material = body;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 2;
      bodyMats.push(body);

      // Layer 2 — slightly inflated back-facing aura shell.
      const aura = createAuraMaterial();
      // inflate is in local units; convert so the shell sits ~2 cm outside the body.
      aura.uniforms['uInflate']!.value = 0.02 / scale;
      const auraMesh = new THREE.Mesh(mesh.geometry, aura);
      auraMesh.userData['holoLayer'] = true;
      auraMesh.renderOrder = 1;
      mesh.add(auraMesh);
      auraMats.push(aura);

      if (quality === "high") {
        const wire = new THREE.Mesh(mesh.geometry, createWireMaterial());
        wire.userData['holoLayer'] = true;
        wire.scale.setScalar(1.002);
        wire.renderOrder = 3;
        mesh.add(wire);
        wireMats.push(wire.material as THREE.MeshBasicMaterial);
      }
    });

    return { bodyMats, auraMats, wireMats };
  }, [model, quality, scale]);

  // Dispose generated materials on unmount.
  useEffect(
    () => () => {
      [...bodyMats, ...auraMats, ...wireMats].forEach((m) => m.dispose());
    },
    [bodyMats, auraMats, wireMats],
  );

  // Colour + highlight state (no per-frame allocation).
  useEffect(() => {
    const edge = new THREE.Color(tint);
    const hi = new THREE.Color(highlightHex);
    const band = selected ? ZONE_BANDS[selected] : null;
    bodyMats.forEach((m) => {
      m.uniforms['uEdge']!.value.copy(edge);
      m.uniforms['uHighlight']!.value.copy(hi);
      m.uniforms['uBandMin']!.value = band ? band[0] : 99;
      m.uniforms['uBandMax']!.value = band ? band[1] : 99;
      m.uniforms['uHighlightAmt']!.value = band ? 1 : 0;
      m.uniforms['uDim']!.value = selected ? 0.45 : 0;
    });
    auraMats.forEach((m) => m.uniforms['uEdge']!.value.copy(edge));
    wireMats.forEach((m) => m.color.copy(edge));
  }, [bodyMats, auraMats, wireMats, tint, highlightHex, selected]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (group.current) group.current.position.y = offset.y + Math.sin(t * 0.8) * 0.015;

    const scanY = TARGET_HEIGHT * (1 - ((t % SCAN_PERIOD) / SCAN_PERIOD)) + 0.02;
    onScan?.(scanY);

    for (let i = 0; i < bodyMats.length; i++) {
      const u = bodyMats[i]!.uniforms;
      u['uTime']!.value = t;
      u['uScanY']!.value = scanY;
      u['uOpacity']!.value = 0.5 + Math.sin(t * 1.5) * 0.04;
    }
    for (let i = 0; i < auraMats.length; i++) auraMats[i]!.uniforms['uTime']!.value = t;
    for (let i = 0; i < wireMats.length; i++) {
      wireMats[i]!.opacity = 0.045 + Math.sin(t * 1.1 + i) * 0.015;
    }
  });

  return (
    <group ref={group} position={[offset.x, offset.y, offset.z]} scale={scale}>
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload(modelAsset.url);
