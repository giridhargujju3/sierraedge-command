import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BodyZone, BodyZoneId } from "@/lib/sms/types";

const BODY_COLOR = "#b0bec5";
const HIGHLIGHT_COLOR = "#4fd8ff";
const TARGET_HEIGHT = 1.75;
const GLB_URL = "/sierraedge-mannequin.glb";

export function GlbBody({
  zones,
  selected,
  onScan,
}: {
  zones: BodyZone[];
  selected: BodyZoneId | null;
  onScan?: (y: number) => void;
}) {
  const { scene } = useGLTF(GLB_URL);
  const group = useRef<THREE.Group>(null);
  const SCAN_PERIOD = 7;

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

  const bodyMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: BODY_COLOR,
      roughness: 0.6,
      metalness: 0.1,
    });
    return mat;
  }, []);

  const highlightMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: HIGHLIGHT_COLOR,
      roughness: 0.4,
      metalness: 0.2,
      emissive: new THREE.Color(HIGHLIGHT_COLOR),
      emissiveIntensity: 0.15,
    });
  }, []);

  useEffect(() => {
    const meshes: THREE.Mesh[] = [];
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) meshes.push(mesh);
    });

    const band = selected ? getZoneBands(selected) : null;

    meshes.forEach((mesh) => {
      if (band) {
        mesh.material = highlightMaterial;
      } else {
        mesh.material = bodyMaterial;
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });

    return () => {
      meshes.forEach((mesh) => {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      });
    };
  }, [model, selected, bodyMaterial, highlightMaterial]);

  useEffect(() => () => {
    bodyMaterial.dispose();
    highlightMaterial.dispose();
  }, [bodyMaterial, highlightMaterial]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (group.current) group.current.position.y = offset.y + Math.sin(t * 0.8) * 0.015;
    const scanY = TARGET_HEIGHT * (1 - ((t % SCAN_PERIOD) / SCAN_PERIOD)) + 0.02;
    onScan?.(scanY);
  });

  return (
    <group ref={group} position={[offset.x, offset.y, offset.z]} scale={scale}>
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload(GLB_URL);

const ZONE_BANDS_SIMPLE: Record<string, [number, number] | undefined> = {
  head: [0.9, 1.0],
  upperBody: [0.65, 0.9],
  arms: [0.55, 0.75],
  core: [0.45, 0.65],
  legs: [0.0, 0.5],
};

function getZoneBands(selected: string): [number, number] | undefined {
  return ZONE_BANDS_SIMPLE[selected];
}
