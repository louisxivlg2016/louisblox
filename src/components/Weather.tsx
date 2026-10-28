import { useMemo } from 'react';
import { useQueryFirst } from 'koota/react';
import { Vector3 } from 'three';
import { Environment, RainMaterial, SnowMaterial } from '../game/traits';

const rainVertex = `
  uniform float uTime;
  uniform vec3 uCamera;
  attribute float aSpeed;
  void main() {
    vec3 p = position;
    p.y = mod(p.y - uTime * 15.0 * aSpeed + 15.0, 30.0) - 15.0;
    p += uCamera;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const rainFragment = `
  uniform float uOpacity;
  void main() {
    gl_FragColor = vec4(0.65, 0.8, 1.0, uOpacity * 0.58);
  }
`;

const snowVertex = `
  uniform float uTime;
  uniform vec3 uCamera;
  attribute float aSpeed;
  void main() {
    vec3 p = position;
    p.y = mod(p.y - uTime * 2.2 * aSpeed + 12.0, 24.0) - 12.0;
    p.x += sin(uTime * 0.8 + position.z) * 1.1;
    p.z += cos(uTime * 0.65 + position.x) * 0.8;
    p += uCamera;
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = clamp(4.2 * aSpeed * (65.0 / -view.z), 1.5, 7.0);
  }
`;

const snowFragment = `
  uniform float uOpacity;
  void main() {
    if (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;
    gl_FragColor = vec4(1.0, 1.0, 1.0, uOpacity * 0.9);
  }
`;

function random(index: number, seed: number) {
  const value = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function Weather() {
  const entity = useQueryFirst(Environment);
  const rainGeometry = useMemo(() => {
    const count = 650;
    const positions = new Float32Array(count * 6);
    const speeds = new Float32Array(count * 2);
    for (let index = 0; index < count; index += 1) {
      const x = (random(index, 1) - 0.5) * 40;
      const y = random(index, 2) * 30;
      const z = (random(index, 3) - 0.5) * 40;
      positions.set([x, y, z, x, y - 0.75, z], index * 6);
      const speed = 0.8 + random(index, 4) * 0.5;
      speeds[index * 2] = speed;
      speeds[index * 2 + 1] = speed;
    }
    return { positions, speeds };
  }, []);
  const snowGeometry = useMemo(() => {
    const count = 850;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      positions.set([
        (random(index, 5) - 0.5) * 38,
        random(index, 6) * 24,
        (random(index, 7) - 0.5) * 38,
      ], index * 3);
      speeds[index] = 0.7 + random(index, 8) * 0.7;
    }
    return { positions, speeds };
  }, []);
  const rainUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uCamera: { value: new Vector3() },
    uOpacity: { value: 0 },
  }), []);
  const snowUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uCamera: { value: new Vector3() },
    uOpacity: { value: 0 },
  }), []);

  if (!entity) return null;
  return (
    <>
      <lineSegments frustumCulled={false} renderOrder={3}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[rainGeometry.positions, 3]} />
          <bufferAttribute attach="attributes-aSpeed" args={[rainGeometry.speeds, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={(material) => {
            const holder = entity.get(RainMaterial);
            if (holder) holder.value = material;
          }}
          uniforms={rainUniforms}
          vertexShader={rainVertex}
          fragmentShader={rainFragment}
          transparent
          depthWrite={false}
        />
      </lineSegments>
      <points frustumCulled={false} renderOrder={3}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[snowGeometry.positions, 3]} />
          <bufferAttribute attach="attributes-aSpeed" args={[snowGeometry.speeds, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={(material) => {
            const holder = entity.get(SnowMaterial);
            if (holder) holder.value = material;
          }}
          uniforms={snowUniforms}
          vertexShader={snowVertex}
          fragmentShader={snowFragment}
          transparent
          depthWrite={false}
        />
      </points>
    </>
  );
}
