import { AnimationClip, AnimationMixer, LoopOnce } from 'three';
import type { Object3D } from 'three';
import headNodData from '../../assets/animations/head-idle.json';

const nodClip = Promise.resolve(AnimationClip.parse(headNodData as unknown as Parameters<typeof AnimationClip.parse>[0]));

export function createHeadIdle(root: Object3D) {
  const mixer = new AnimationMixer(root);
  const head = root.getObjectByName('head');
  let nodAction: ReturnType<AnimationMixer['clipAction']> | undefined;
  let nodding = false;
  let time = 0;
  void nodClip.then((animation) => {
    nodAction = mixer.clipAction(animation);
    nodAction.setLoop(LoopOnce, 1);
    nodAction.clampWhenFinished = true;
  });
  return {
    update: (delta: number, nodActive: boolean, _swayActive: boolean) => {
      time += delta;
      if (head) head.rotation.y = Math.sin(time * 1.6) * 0.35;
      if (nodAction) {
        if (nodActive && !nodding) nodAction.reset().play();
        if (!nodActive && nodding) nodAction.fadeOut(0.18);
      }
      nodding = nodActive;
      mixer.update(delta);
    },
    dispose: () => mixer.stopAllAction(),
  };
}
