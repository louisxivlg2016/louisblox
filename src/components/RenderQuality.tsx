import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../game/store';

export function RenderQuality() {
  const gl = useThree((state) => state.gl);
  const setDpr = useThree((state) => state.setDpr);
  const invalidate = useThree((state) => state.invalidate);
  const sample = useRef({ elapsed: 0, frames: 0 });

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (useGameStore.getState().mode !== 'play' && !document.hidden) invalidate();
    }, 250);
    return () => window.clearInterval(timer);
  }, [invalidate]);

  useFrame((_, delta) => {
    if (useGameStore.getState().mode !== 'play' || document.hidden) {
      sample.current.elapsed = 0;
      sample.current.frames = 0;
      return;
    }
    invalidate();
    sample.current.elapsed += delta;
    sample.current.frames += 1;
    if (sample.current.elapsed < 2.5) return;
    const fps = sample.current.frames / sample.current.elapsed;
    const dpr = gl.getPixelRatio();
    sample.current.elapsed = 0;
    sample.current.frames = 0;
    if (fps >= 30 || dpr <= 0.5) return;
    setDpr(Math.max(0.5, Math.round((dpr - 0.15) * 100) / 100));
  });
  return null;
}
