import { AnimationClip, AnimationMixer, LoopOnce } from 'three';
import type { Object3D } from 'three';
import headIdleData from '../../assets/animations/head-idle.json';

const clip = Promise.resolve(AnimationClip.parse(headIdleData as unknown as Parameters<typeof AnimationClip.parse>[0]));

export function createHeadIdle(root: Object3D) {
  const mixer = new AnimationMixer(root);
  let action: ReturnType<AnimationMixer['clipAction']> | undefined;
  let turning = false;
  void clip.then((animation) => {
    action = mixer.clipAction(animation);
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
  });
  return {
    update: (delta: number, active: boolean) => {
      if (active && !turning && action) {
        action.reset().fadeIn(0.08).play();
      } else if (!active && turning && action) {
        action.fadeOut(0.18);
      }
      turning = active;
      mixer.update(delta);
    },
    dispose: () => mixer.stopAllAction(),
  };
}
