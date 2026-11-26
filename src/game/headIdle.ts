import { AnimationClip, AnimationMixer } from 'three';
import type { Object3D } from 'three';
import headIdleData from '../../assets/animations/head-idle.json';

const clip = Promise.resolve(AnimationClip.parse(headIdleData as unknown as Parameters<typeof AnimationClip.parse>[0]));

export function createHeadIdle(root: Object3D) {
  const mixer = new AnimationMixer(root);
  void clip.then((animation) => mixer.clipAction(animation).play());
  return {
    update: (delta: number) => mixer.update(delta),
    dispose: () => mixer.stopAllAction(),
  };
}
