import type { WeatherId } from '@bale/shared';
import { BufferAttribute, BufferGeometry, Points, ShaderMaterial } from 'three';

export const MAX_RAIN_PARTICLES = 2000;

const VERTEX_SHADER = `
uniform float uTime;
uniform vec2 uCenter;
void main() {
  vec3 drop = position;
  drop.y = mod(drop.y - uTime * 11.0, 14.0);
  drop.xz += uCenter;
  vec4 view = modelViewMatrix * vec4(drop, 1.0);
  gl_Position = projectionMatrix * view;
  gl_PointSize = 2.0;
}
`;

const FRAGMENT_SHADER = `
uniform float uStrength;
void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  if (dot(p, p) > 0.25) discard;
  gl_FragColor = vec4(0.58, 0.78, 0.9, (0.45 + p.y * 0.2) * uStrength);
}
`;

/** One draw call of deterministic placeholder rain, centred on the camera follow target. */
export class RainField {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  private readonly time = { value: 0 };
  private readonly center = { value: [0, 0] };
  private readonly strength = { value: 0 };

  constructor() {
    const positions = new Float32Array(MAX_RAIN_PARTICLES * 3);
    for (let i = 0; i < MAX_RAIN_PARTICLES; i++) {
      const offset = i * 3;
      positions[offset] = hash(i, 17) * 28 - 14;
      positions[offset + 1] = hash(i, 53) * 14;
      positions[offset + 2] = hash(i, 97) * 28 - 14;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    const material = new ShaderMaterial({
      uniforms: { uTime: this.time, uCenter: this.center, uStrength: this.strength },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
    });
    this.points = new Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  setWeather(weather: WeatherId, particleLimit: number): void {
    const raining = weather === 'rain' || weather === 'storm';
    this.points.visible = raining;
    this.strength.value = weather === 'storm' ? 1 : raining ? 0.75 : 0;
    const weatherCount = weather === 'rain' ? Math.floor(particleLimit * 0.75) : particleLimit;
    this.points.geometry.setDrawRange(0, raining ? weatherCount : 0);
  }

  update(simSeconds: number, centerX: number, centerZ: number): void {
    this.time.value = simSeconds;
    this.center.value[0] = centerX;
    this.center.value[1] = centerZ;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

/** Integer-only pseudo-random placement; stable across browsers and sessions. */
function hash(index: number, salt: number): number {
  let value = Math.imul(index + salt, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
}
