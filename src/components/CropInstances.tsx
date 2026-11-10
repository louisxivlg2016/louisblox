import { useLayoutEffect, useRef } from 'react';
import { InstancedMesh, Matrix4 } from 'three';
import { animalMaterial } from '../game/animalTextures';
import { blockGeometry } from '../game/textures';
import { BlockKind } from '../game/voxel';
import type { Voxel } from '../game/voxel';

type Part = { x: number; y: number; z: number; sx: number; sy: number; sz: number; color: string };
type PositionedPart = { block: Voxel; part: Part };
const matrix = new Matrix4();
const green = '#4e813b';

function cropParts(block: Voxel): Part[] {
  const stage = block.growth ?? 3;
  const parts: Part[] = [];
  const add = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string) => parts.push({ x, y, z, sx, sy, sz, color });
  if (stage === 0) {
    add(0, -0.4, 0, 0.07, 0.2, 0.07, green);
    add(0.08, -0.33, 0, 0.18, 0.06, 0.12, '#6b9d48');
    return parts;
  }

  if (block.kind === BlockKind.Corn) {
    const height = [0.2, 0.5, 0.95, 1.65][stage];
    add(0, -0.5 + height / 2, 0, 0.11, height, 0.11, '#659444');
    for (const sign of [-1, 1]) {
      add(sign * 0.18, -0.5 + height * 0.48, 0, 0.42, 0.1, 0.17, green);
      add(0, -0.5 + height * 0.7, sign * 0.17, 0.16, 0.09, 0.38, '#76a34b');
    }
    if (stage >= 2) {
      const size = stage === 2 ? 0.13 : 0.22;
      add(0.17, -0.5 + height * 0.67, 0, size, height * 0.28, size, '#e1bf3d');
      add(-0.16, -0.5 + height * 0.48, 0.04, size, height * 0.24, size, '#edcf4e');
    }
    if (stage === 3) add(0, -0.5 + height + 0.08, 0, 0.17, 0.18, 0.17, '#d2b453');
    return parts;
  }

  if (block.kind === BlockKind.Wheat) {
    const height = [0.2, 0.42, 0.72, 1.05][stage];
    for (const x of [-0.22, 0, 0.22]) {
      add(x, -0.5 + height / 2, 0, 0.055, height, 0.055, stage === 3 ? '#b5a14d' : green);
      if (stage >= 2) add(x, -0.5 + height, 0, 0.14, stage === 2 ? 0.18 : 0.28, 0.14, stage === 2 ? '#a3a34d' : '#d5b75d');
    }
    return parts;
  }

  if (block.kind === BlockKind.Tomato) {
    const height = [0.2, 0.36, 0.62, 0.82][stage];
    add(0, -0.5 + height / 2, 0, 0.09, height, 0.09, '#477840');
    add(0, -0.5 + height * 0.65, 0, 0.62, height * 0.5, 0.54, green);
    if (stage >= 2) {
      const size = stage === 2 ? 0.13 : 0.22;
      for (const [x, z, y] of [[-0.23, -0.19, -0.12], [0.24, -0.13, -0.03], [0.08, 0.22, -0.15]]) add(x, y, z, size, size, size, stage === 2 ? '#c49a43' : '#d94332');
    }
    return parts;
  }

  if (block.kind === BlockKind.Carrot) {
    const height = [0.2, 0.3, 0.46, 0.65][stage];
    for (const x of [-0.14, 0, 0.14]) add(x, -0.5 + height / 2, 0, 0.08, height, 0.1, x === 0 ? '#6a9f47' : green);
    if (stage >= 2) {
      const size = stage === 2 ? 0.16 : 0.26;
      add(0, -0.42, 0, size, 0.35, size, '#e68a2e');
      add(0, -0.25, 0, size * 0.75, 0.16, size * 0.75, '#ed9c39');
    }
    return parts;
  }

  const vineHeight = stage === 1 ? 0.08 : 0.12;
  add(0, -0.5 + vineHeight / 2, 0, 0.82, vineHeight, 0.16, green);
  add(0.15, -0.5 + vineHeight / 2, 0, 0.16, vineHeight, 0.76, '#669844');
  if (stage >= 2) {
    const size = stage === 2 ? 0.32 : 0.58;
    add(0.14, -0.5 + size / 2 + 0.04, 0.05, size, size, size, '#5c9847');
    for (const x of [-0.16, 0.16]) add(0.14 + x, -0.5 + size / 2 + 0.04, 0.05 - size / 2 - 0.012, 0.055, size, 0.025, '#326d3b');
    add(0.14, -0.5 + size + 0.09, 0.05, 0.08, 0.14, 0.08, '#785335');
  }
  return parts;
}

function CropPartInstances({ parts, color }: { parts: PositionedPart[]; color: string }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    parts.forEach(({ block, part }, index) => {
      matrix.makeScale(part.sx, part.sy, part.sz);
      matrix.setPosition(block.x + part.x, block.y + part.y, block.z + part.z);
      ref.current!.setMatrixAt(index, matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [parts]);
  return <instancedMesh ref={ref} args={[blockGeometry, animalMaterial(color), parts.length]} dispose={null} />;
}

export function CropInstances({ blocks }: { blocks: Voxel[] }) {
  const groups = new Map<string, PositionedPart[]>();
  for (const block of blocks) {
    for (const part of cropParts(block)) {
      const group = groups.get(part.color) ?? [];
      group.push({ block, part });
      groups.set(part.color, group);
    }
  }
  return [...groups.entries()].map(([color, parts]) => <CropPartInstances key={color} color={color} parts={parts} />);
}
