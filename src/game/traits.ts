import { trait } from 'koota';
import { Vector3 } from 'three';
import type { RapierCollider, RapierRigidBody } from '@react-three/rapier';

export const Player = trait();
export const PlayerPosition = trait(() => new Vector3());
export const PlayerVelocity = trait(() => new Vector3());
export const PlayerBody = trait(() => ({ value: null as RapierRigidBody | null }));
export const PlayerCollider = trait(() => ({ value: null as RapierCollider | null }));
export const PlayerMesh = trait(() => ({ value: null as import('three').Object3D | null }));
export const PlayerState = trait({ grounded: false, flying: false, yaw: 0, pitch: 0 });

export const BlockTarget = trait(() => ({
  position: new Vector3(),
  normal: new Vector3(0, 1, 0),
  visible: false,
  miningKey: '',
  miningProgress: 0,
}));
export const TargetMesh = trait(() => ({ value: null as import('three').Object3D | null }));

export const Chunk = trait({ x: 0, z: 0, revision: 0 });
export const ChunkData = trait(() => ({
  blocks: [] as import('./voxel').Voxel[],
  water: [] as import('./levels').WaterTile[],
  animals: [] as import('koota').Entity[],
  bombs: [] as import('koota').Entity[],
}));

export const Bomb = trait({ fuse: 3 });
export const BombPosition = trait(() => new Vector3());
export const Explosion = trait({ time: 0.45, maxTime: 0.45 });
export const ExplosionPosition = trait(() => new Vector3());
export const ExplosionMesh = trait(() => ({ value: null as import('three').Object3D | null }));
export const ExplosionMaterial = trait(() => ({ value: null as import('three').MeshBasicMaterial | null }));

export const Animal = trait({ kind: '' as import('./animals').AnimalKind });
export const AnimalHealth = trait({ value: 3 });
export const AnimalHit = trait({ time: 0, panic: 0, flashed: false });
export const AnimalPosition = trait(() => new Vector3());
export const AnimalMotion = trait({ yaw: 0, turnIn: 0, phase: 0, speed: 0.5, idle: 0 });
export const AnimalMesh = trait(() => ({ value: null as import('three').Object3D | null }));

export const MeatDrop = trait({ kind: '' as import('./animals').AnimalKind });
export const MeatDropPosition = trait(() => new Vector3());
export const MeatDropMotion = trait({ age: 0, baseY: 0 });
export const MeatDropMesh = trait(() => ({ value: null as import('three').Object3D | null }));

export const Environment = trait(() => ({
  elapsed: 0,
  dayProgress: 0.38,
  weather: 'clear' as 'clear' | 'rain' | 'snow',
  biome: 'prairie' as import('./levels').Biome,
  uiTimer: 0,
  saveTimer: 0,
}));
export const RainMaterial = trait(() => ({ value: null as import('three').ShaderMaterial | null }));
export const SnowMaterial = trait(() => ({ value: null as import('three').ShaderMaterial | null }));
