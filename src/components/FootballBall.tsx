import { useMemo } from 'react';
import { useFootballStore } from '../game/footballClient';
import { PixelPart } from './ItemModel';

export function FootballBall() {
  const ball = useFootballStore((state) => state.ball);
  const patches = useMemo(() => [
    [0, 0.34, 0], [0.22, 0.19, 0.18], [-0.22, -0.12, 0.22], [0.15, -0.28, -0.16], [-0.22, 0.12, -0.2],
  ] as const, []);
  return (
    <group name="football-ball" position={[ball.x, ball.y, ball.z]} rotation={[ball.z * 0.7, 0, -ball.x * 0.7]}>
      <PixelPart position={[0, 0, 0]} size={[0.56, 0.56, 0.56]} color="#f5f3e8" />
      {patches.map((position, index) => <PixelPart key={index} position={[...position]} size={[0.22, 0.16, 0.22]} color="#26303b" />)}
    </group>
  );
}
