import { useEffect, useMemo } from 'react';
import { CanvasTexture, DoubleSide, MeshLambertMaterial, SRGBColorSpace } from 'three';
import { usePlaneTitleStore } from '../game/planeTitle';

export function VehicleTitle({ title, width, height, position, name, roll = 0, slide = 0 }: { title: string; width: number; height: number; position: [number, number, number]; name: string; roll?: number; slide?: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const context = canvas.getContext('2d')!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '900 132px monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 18;
    context.strokeStyle = '#5b3b08';
    context.strokeText(title, 512, 132, 960);
    context.fillStyle = '#f5c842';
    context.fillText(title, 512, 132, 960);
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    return result;
  }, [title]);
  const material = useMemo(() => new MeshLambertMaterial({ map: texture, transparent: true, side: DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), [texture]);
  useEffect(() => () => {
    texture.dispose();
    material.dispose();
  }, [texture, material]);
  return (
    <group name={name}>
      {[-1, 1].map((side) => (
        <group key={side} position={[position[0] * side, position[1], position[2] - side * slide]} rotation={[0, 0, side * roll]}>
          <mesh rotation={[0, side * Math.PI / 2, 0]} material={material}>
            <planeGeometry args={[width, height]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function PlaneTitle() {
  const title = usePlaneTitleStore((state) => state.title);
  return <VehicleTitle title={title} width={16} height={4} position={[4.7, 9, -10]} roll={0.35} name="plane-gold-title" />;
}
