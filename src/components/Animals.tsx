import { useQuery } from 'koota/react';
import type { Entity } from 'koota';
import type { AnimalKind } from '../game/animals';
import { animalMaterial } from '../game/animalTextures';
import { Animal, AnimalMesh, AnimalPosition } from '../game/traits';

type Model = {
  body: string;
  head: string;
  legs: string;
  scale: number;
  bird?: boolean;
  humps?: boolean;
  horns?: boolean;
  antlers?: boolean;
};

const models: Record<AnimalKind, Model> = {
  camel: { body: '#c59a59', head: '#d2ad6d', legs: '#a77c43', scale: 1.15, humps: true },
  cow: { body: '#714633', head: '#e5ddd0', legs: '#4b3329', scale: 1, horns: true },
  horse: { body: '#875533', head: '#6f4128', legs: '#3f2b21', scale: 1.1 },
  pig: { body: '#df8f98', head: '#eda3aa', legs: '#b96570', scale: 0.85 },
  sheep: { body: '#e5e1d4', head: '#66564b', legs: '#54483f', scale: 0.95 },
  chicken: { body: '#f1eee0', head: '#f7f3e8', legs: '#d69a38', scale: 0.65, bird: true },
  duck: { body: '#e8e6d8', head: '#2e6848', legs: '#d69a38', scale: 0.75, bird: true },
  bear: { body: '#5a3b2a', head: '#6a4732', legs: '#3d291f', scale: 1.25 },
  deer: { body: '#a87643', head: '#ba8b55', legs: '#62442d', scale: 0.95, antlers: true },
  wolf: { body: '#73777b', head: '#8b9094', legs: '#4e5357', scale: 0.85 },
  snowWolf: { body: '#dce7eb', head: '#eef4f6', legs: '#aebdc4', scale: 0.9 },
  snowBear: { body: '#e4eaeb', head: '#f3f6f6', legs: '#bac5c8', scale: 1.3 },
};

function Box({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  return (
    <mesh position={position} material={animalMaterial(color)} dispose={null}>
      <boxGeometry args={size} />
    </mesh>
  );
}

function Bird({ model, kind }: { model: Model; kind: AnimalKind }) {
  return (
    <>
      <Box position={[0, 0.42, 0]} size={[0.46, 0.48, 0.5]} color={model.body} />
      <Box position={[0, 0.78, 0.24]} size={[0.36, 0.36, 0.36]} color={model.head} />
      <Box position={[0, 0.76, 0.48]} size={[0.18, 0.1, 0.2]} color="#e5a33c" />
      <Box position={[-0.1, 0.1, 0]} size={[0.06, 0.2, 0.06]} color={model.legs} />
      <Box position={[0.1, 0.1, 0]} size={[0.06, 0.2, 0.06]} color={model.legs} />
      <Box position={[-0.27, 0.46, 0]} size={[0.12, 0.3, 0.38]} color={model.body} />
      <Box position={[0.27, 0.46, 0]} size={[0.12, 0.3, 0.38]} color={model.body} />
      <Box position={[-0.1, 0.84, 0.42]} size={[0.045, 0.045, 0.03]} color="#111111" />
      <Box position={[0.1, 0.84, 0.42]} size={[0.045, 0.045, 0.03]} color="#111111" />
      {kind === 'chicken' && (
        <>
          <Box position={[0, 1.01, 0.24]} size={[0.13, 0.14, 0.13]} color="#bd3b35" />
          <Box position={[0, 0.61, 0.43]} size={[0.1, 0.15, 0.08]} color="#bd3b35" />
        </>
      )}
    </>
  );
}

function Quadruped({ model, kind }: { model: Model; kind: AnimalKind }) {
  const camel = kind === 'camel';
  const headY = camel ? 1.72 : 0.98;
  const headZ = camel ? 0.93 : 0.73;
  return (
    <>
      <Box position={[0, 0.86, 0]} size={[0.62, 0.68, 1.25]} color={model.body} />
      {camel && <Box position={[0, 1.3, 0.62]} size={[0.3, 0.95, 0.32]} color={model.head} />}
      <Box position={[0, headY, headZ]} size={[0.48, 0.48, 0.48]} color={model.head} />
      <Box position={[0.22, 0.3, 0.42]} size={[0.16, 0.6, 0.16]} color={model.legs} />
      <Box position={[-0.22, 0.3, 0.42]} size={[0.16, 0.6, 0.16]} color={model.legs} />
      <Box position={[0.22, 0.3, -0.42]} size={[0.16, 0.6, 0.16]} color={model.legs} />
      <Box position={[-0.22, 0.3, -0.42]} size={[0.16, 0.6, 0.16]} color={model.legs} />
      <Box position={[-0.16, headY + 0.05, headZ + 0.27]} size={[0.06, 0.06, 0.04]} color="#151515" />
      <Box position={[0.16, headY + 0.05, headZ + 0.27]} size={[0.06, 0.06, 0.04]} color="#151515" />
      <Box position={[0, headY - 0.12, headZ + 0.31]} size={[0.28, 0.2, 0.18]} color={model.head} />
      {model.humps && (
        <>
          <Box position={[0, 1.35, 0.28]} size={[0.38, 0.36, 0.38]} color={model.body} />
          <Box position={[0, 1.35, -0.28]} size={[0.38, 0.36, 0.38]} color={model.body} />
        </>
      )}
      {model.horns && (
        <>
          <Box position={[-0.23, 1.26, 0.72]} size={[0.1, 0.2, 0.1]} color="#e8e0c9" />
          <Box position={[0.23, 1.26, 0.72]} size={[0.1, 0.2, 0.1]} color="#e8e0c9" />
          <Box position={[0.32, 0.95, 0.2]} size={[0.035, 0.34, 0.42]} color="#2c241f" />
          <Box position={[-0.32, 0.83, -0.28]} size={[0.035, 0.28, 0.35]} color="#2c241f" />
        </>
      )}
      {kind === 'horse' && (
        <>
          <Box position={[0, 1.25, 0.35]} size={[0.14, 0.5, 0.72]} color="#2e211b" />
          <Box position={[0, 0.82, -0.84]} size={[0.18, 0.68, 0.2]} color="#2e211b" />
        </>
      )}
      {(kind === 'wolf' || kind === 'snowWolf' || kind === 'bear' || kind === 'snowBear') && (
        <>
          <Box position={[-0.17, headY + 0.3, headZ]} size={[0.14, 0.2, 0.14]} color={model.head} />
          <Box position={[0.17, headY + 0.3, headZ]} size={[0.14, 0.2, 0.14]} color={model.head} />
        </>
      )}
      {model.antlers && (
        <>
          <Box position={[-0.17, 1.4, 0.7]} size={[0.08, 0.38, 0.08]} color="#5d422b" />
          <Box position={[0.17, 1.4, 0.7]} size={[0.08, 0.38, 0.08]} color="#5d422b" />
          <Box position={[-0.17, 1.42, 0.7]} size={[0.28, 0.07, 0.08]} color="#5d422b" />
          <Box position={[0.17, 1.42, 0.7]} size={[0.28, 0.07, 0.08]} color="#5d422b" />
        </>
      )}
      {kind === 'pig' && <Box position={[0, 0.9, 1.01]} size={[0.25, 0.18, 0.12]} color="#f0a3ad" />}
      {(kind === 'wolf' || kind === 'snowWolf') && <Box position={[0, 1, -0.76]} size={[0.16, 0.16, 0.55]} color={model.body} />}
      {kind === 'sheep' && <Box position={[0, 0.94, -0.05]} size={[0.7, 0.58, 1.32]} color="#f0ede2" />}
    </>
  );
}

function AnimalView({ entity }: { entity: Entity }) {
  const kind = entity.get(Animal)!.kind;
  const position = entity.get(AnimalPosition)!;
  const model = models[kind];

  return (
    <group
      ref={(group) => {
        const holder = entity.get(AnimalMesh);
        if (holder) holder.value = group;
      }}
      position={[position.x, position.y, position.z]}
      scale={model.scale}
    >
      {model.bird ? <Bird model={model} kind={kind} /> : <Quadruped model={model} kind={kind} />}
    </group>
  );
}

export function Animals() {
  const animals = useQuery(Animal);
  return animals.map((entity) => <AnimalView key={entity} entity={entity} />);
}
