import { AnimationClip, AnimationMixer, LoopOnce } from 'three';
import type { Object3D } from 'three';
import headNodData from '../../assets/animations/head-idle.json';
import headSwayData from '../../assets/animations/head-sway.json';

const nodClip = Promise.resolve(AnimationClip.parse(headNodData as unknown as Parameters<typeof AnimationClip.parse>[0]));
const swayClip = Promise.resolve(AnimationClip.parse(headSwayData as unknown as Parameters<typeof AnimationClip.parse>[0]));

export function createHeadIdle(root: Object3D) {
  const mixer = new AnimationMixer(root);
  let nodAction: ReturnType<AnimationMixer['clipAction']> | undefined;
  let swayAction: ReturnType<AnimationMixer['clipAction']> | undefined;
  let nodding = false;
  let swaying = false;
  void nodClip.then((animation) => {
    nodAction = mixer.clipAction(animation);
    nodAction.setLoop(LoopOnce, 1);
    nodAction.clampWhenFinished = true;
  });
  void swayClip.then((animation) => {
    swayAction = mixer.clipAction(animation);
    swayAction.setLoop(LoopOnce, 1);
    swayAction.clampWhenFinished = true;
  });
  return {
    update: (delta: number, nodActive: boolean, swayActive: boolean) => {
      if (nodAction) {
        if (nodActive && !nodding) nodAction.reset().play();
        if (!nodActive && nodding) nodAction.fadeOut(0.18);
        nodAction.setEffectiveWeight(swayActive ? 0.5 : 1);
      }
      if (swayAction) {
        if (swayActive && !swaying) swayAction.reset().play();
        if (!swayActive && swaying) swayAction.fadeOut(0.18);
        swayAction.setEffectiveWeight(nodActive ? 0.5 : 1);
      }
      nodding = nodActive;
      swaying = swayActive;
      mixer.update(delta);
    },
    dispose: () => mixer.stopAllAction(),
  };
}
