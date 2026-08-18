import * as THREE from "three";
import type { BodyZoneId } from "@/lib/sms/types";

/** Vertical bands (metres, model space, 1.75 m tall) used to highlight a zone on the real geometry. */
export const ZONE_BANDS: Record<BodyZoneId, [number, number]> = {
  head: [1.5, 1.78],
  upperBody: [1.15, 1.5],
  arms: [0.85, 1.45],
  core: [0.9, 1.2],
  legs: [0.0, 0.9],
};

const COMMON_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDirW;
  varying vec3 vPosL;
  uniform float uInflate;
  void main() {
    vPosL = (modelMatrix * vec4(position, 1.0)).xyz;
    vec3 n = normalize(normalMatrix * normal);
    vNormalW = n;
    vec3 inflated = position + normal * uInflate;
    vec4 mv = modelViewMatrix * vec4(inflated, 1.0);
    vViewDirW = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const BODY_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vNormalW;
  varying vec3 vViewDirW;
  varying vec3 vPosL;

  uniform float uTime;
  uniform vec3  uCore;
  uniform vec3  uEdge;
  uniform vec3  uHighlight;
  uniform float uOpacity;
  uniform float uScanY;
  uniform float uBandMin;
  uniform float uBandMax;
  uniform float uHighlightAmt;
  uniform float uDim;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewDirW);
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.2);

    // scanlines along body height
    float lines = 0.5 + 0.5 * sin(vPosL.y * 190.0 - uTime * 1.4);
    lines = mix(1.0, lines, 0.18);

    // holographic noise
    float noise = hash(floor(vec2(vPosL.x * 140.0, vPosL.y * 140.0 - uTime * 6.0)));
    float grain = mix(0.94, 1.06, noise);

    // travelling scan sweep
    float sweep = exp(-pow((vPosL.y - uScanY) * 26.0, 2.0));

    // zone highlight band
    float band = smoothstep(uBandMin - 0.04, uBandMin + 0.03, vPosL.y)
               * (1.0 - smoothstep(uBandMax - 0.03, uBandMax + 0.04, vPosL.y));
    float hl = band * uHighlightAmt;

    vec3 col = mix(uCore * 0.35, uEdge, fres);
    col = mix(col, uHighlight, hl * 0.85);
    col += uEdge * sweep * 0.35;
    col *= lines * grain;
    col *= mix(0.45, 1.0, 1.0 - uDim);

    float alpha = uOpacity * (0.03 + fres * 1.0) + sweep * 0.10 + hl * 0.14;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

const AURA_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vNormalW;
  varying vec3 vViewDirW;
  varying vec3 vPosL;
  uniform float uTime;
  uniform vec3  uEdge;
  uniform float uOpacity;
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewDirW);
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.6);
    float pulse = 0.85 + 0.15 * sin(uTime * 1.6);
    float a = fres * uOpacity * pulse;
    gl_FragColor = vec4(uEdge, clamp(a, 0.0, 1.0));
  }
`;

export function createBodyMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: COMMON_VERT,
    fragmentShader: BODY_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    uniforms: {
      uInflate: { value: 0 },
      uTime: { value: 0 },
      uCore: { value: new THREE.Color("#062535") },
      uEdge: { value: new THREE.Color("#4fd8ff") },
      uHighlight: { value: new THREE.Color("#ffffff") },
      uOpacity: { value: 0.30 },
      uScanY: { value: -1 },
      uBandMin: { value: 99 },
      uBandMax: { value: 99 },
      uHighlightAmt: { value: 0 },
      uDim: { value: 0 },
    },
  });
}

export function createAuraMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: COMMON_VERT,
    fragmentShader: AURA_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: {
      uInflate: { value: 0.02 },
      uTime: { value: 0 },
      uEdge: { value: new THREE.Color("#38c6f4") },
      uOpacity: { value: 0.28 },
    },
  });
}

export function createWireMaterial() {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color("#63e2ff"),
    wireframe: true,
    transparent: true,
    opacity: 0.05,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
