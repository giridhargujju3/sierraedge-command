import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BodyZone, BodyZoneId, Status } from "@/lib/sms/types";
import { statusHex } from "@/lib/sms/status";
import modelAsset from "@/assets/sierraedge-mannequin.glb.asset.json";

const HUD = "#38c6f4";
/** Target height in metres so uploaded models line up with the sensor anchors. */
const TARGET_HEIGHT = 1.75;

export function GlbBody({
  zones,
  selected,
}: {
  zones: BodyZone[];
  selected: BodyZoneId | null;
}) {
  const { scene } = useGLTF(modelAsset.url);
  const group = useRef<THREE.Group>(null);

  const worst: Status = zones.some((z) => z.status === "crit")
    ? "crit"
    : zones.some((z) => z.status === "warn")
      ? "warn"
      : "ok";
  const tint = worst === "ok" ? HUD : statusHex[worst];

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

  // Replace every material with a holographic shell so the model reads as a digital twin.
  const materials = useMemo(() => {
    const list: THREE.Material[] = [];
    // Collect first: adding children during traverse() would recurse forever.
    const meshes: THREE.Mesh[] = [];
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && !mesh.userData.holoWire) meshes.push(mesh);
    });

    meshes.forEach((mesh) => {
      const holo = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(tint),
        emissive: new THREE.Color(tint),
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.3,
        roughness: 0.1,
        metalness: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      mesh.material = holo;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      list.push(holo);

      // Wireframe shell gives the scan-grid digital-twin read.
      const wire = new THREE.Mesh(
        mesh.geometry,
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(tint),
          wireframe: true,
          transparent: true,
          opacity: 0.08,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      wire.userData.holoWire = true;
      wire.scale.setScalar(1.002);
      mesh.add(wire);
    });
    return list;
  }, [model, tint]);


  useEffect(() => {
    const color = new THREE.Color(selected ? "#ffffff" : tint);
    materials.forEach((m) => {
      const mat = m as THREE.MeshPhysicalMaterial;
      mat.color.copy(color);
      mat.emissive.copy(new THREE.Color(tint));
    });
  }, [materials, tint, selected]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.position.y = offset.y + Math.sin(clock.elapsedTime * 0.8) * 0.015;
    const pulse = 0.7 + Math.sin(clock.elapsedTime * 1.6) * 0.18;
    materials.forEach((m) => ((m as THREE.MeshPhysicalMaterial).emissiveIntensity = pulse));
  });

  return (
    <group ref={group} position={[offset.x, offset.y, offset.z]} scale={scale}>
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload(modelAsset.url);
