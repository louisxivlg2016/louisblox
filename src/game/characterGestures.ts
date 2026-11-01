import { MathUtils, Quaternion, Vector3 } from 'three';
import type { Object3D } from 'three';
import type { EmoteKind } from './emotes';

const start = new Vector3();
const end = new Vector3();
const currentDirection = new Vector3();
const targetDirection = new Vector3();
const parentRotation = new Quaternion();
const worldRotation = new Quaternion();
const localRotation = new Quaternion();
const identity = new Quaternion();
const modelRotation = new Quaternion();
const hipStates = new WeakMap<Object3D, { base: Vector3; blend: number }>();

function findBone(root: Object3D, name: string) {
  let result: Object3D | undefined;
  root.traverse((object) => {
    if (!result && object.type === 'Bone' && object.name.toLocaleLowerCase() === name.toLocaleLowerCase()) result = object;
  });
  return result;
}

function aim(root: Object3D, boneName: string, childName: string, direction: Vector3, blend: number) {
  const bone = findBone(root, boneName);
  const child = findBone(root, childName);
  if (!bone || !child || !bone.parent) return;
  bone.getWorldPosition(start);
  child.getWorldPosition(end);
  currentDirection.subVectors(end, start).normalize();
  if (currentDirection.lengthSq() < 0.01) return;
  worldRotation.setFromUnitVectors(currentDirection, direction);
  worldRotation.slerp(identity, 1 - blend);
  bone.parent.getWorldQuaternion(parentRotation).invert();
  localRotation.copy(parentRotation).multiply(worldRotation).multiply(parentRotation.invert());
  bone.quaternion.premultiply(localRotation).normalize();
  bone.updateMatrixWorld(true);
}

function direction(root: Object3D, x: number, y: number, z: number) {
  root.getWorldQuaternion(modelRotation);
  return targetDirection.set(x, y, z).applyQuaternion(modelRotation).normalize();
}

function sitHips(root: Object3D, seated: boolean, delta: number) {
  const hips = findBone(root, 'Hips');
  if (!hips?.parent) return;
  let state = hipStates.get(hips);
  if (seated && !state) {
    state = { base: hips.position.clone(), blend: 0 };
    hipStates.set(hips, state);
  }
  if (!state) return;
  state.blend = MathUtils.damp(state.blend, seated ? 1 : 0, 12, delta);
  hips.getWorldPosition(start);
  start.y -= 0.42;
  hips.parent.worldToLocal(start);
  hips.position.lerpVectors(state.base, start, state.blend);
  hips.updateMatrixWorld(true);
  if (!seated && state.blend < 0.005) {
    hips.position.copy(state.base);
    hipStates.delete(hips);
  }
}

export function applyCharacterGesture(root: Object3D, emote: EmoteKind | null | undefined, seated: boolean, idle: boolean, time: number, delta: number) {
  const sitting = seated || emote === 'sit';
  const blend = 1 - Math.exp(-delta * 12);
  if (sitting || idle || emote === 'wave') {
    aim(root, 'LeftArm', 'LeftForeArm', direction(root, 0.08, -1, 0), blend);
    aim(root, 'LeftForeArm', 'LeftHand', direction(root, 0.04, -1, -0.08), blend);
    if (emote === 'wave') {
      aim(root, 'RightArm', 'RightForeArm', direction(root, 0.22, 1, -0.08), blend);
      aim(root, 'RightForeArm', 'RightHand', direction(root, Math.sin(time * 8) * 0.65, 0.85, -0.15), blend);
    } else {
      aim(root, 'RightArm', 'RightForeArm', direction(root, -0.08, -1, 0), blend);
      aim(root, 'RightForeArm', 'RightHand', direction(root, -0.04, -1, -0.08), blend);
    }
  }
  if (sitting) {
    aim(root, 'LeftUpLeg', 'LeftLeg', direction(root, 0, 0.03, -1), blend);
    aim(root, 'LeftLeg', 'LeftFoot', direction(root, 0, -1, 0.05), blend);
    aim(root, 'RightUpLeg', 'RightLeg', direction(root, 0, 0.03, -1), blend);
    aim(root, 'RightLeg', 'RightFoot', direction(root, 0, -1, 0.05), blend);
  }
  sitHips(root, sitting, delta);
}
