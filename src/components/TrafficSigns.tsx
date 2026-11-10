import { useEffect, useMemo, useState } from 'react';
import { Box3, FrontSide, NearestFilter, Vector3 } from 'three';
import type { Group, Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BlockKind } from '../game/voxel';
import stopUrl from '../../assets/models/traffic-sign-stop.glb';
import yieldUrl from '../../assets/models/traffic-sign-yield.glb';
import noEntryUrl from '../../assets/models/traffic-sign-no-entry.glb';
import oneWayUrl from '../../assets/models/traffic-sign-one-way.glb';
import speed50Url from '../../assets/models/traffic-sign-speed-50.glb';
import pedestrianUrl from '../../assets/models/traffic-sign-pedestrian.glb';
import schoolUrl from '../../assets/models/traffic-sign-school.glb';
import parkingUrl from '../../assets/models/traffic-sign-parking.glb';
import directionUrl from '../../assets/models/traffic-sign-direction.glb';
import dangerUrl from '../../assets/models/traffic-sign-danger.glb';
import roundaboutUrl from '../../assets/models/traffic-sign-roundabout.glb';
import priorityUrl from '../../assets/models/traffic-sign-priority.glb';

const models: Partial<Record<BlockKind, string>> = {
  [BlockKind.StopSign]: stopUrl,
  [BlockKind.YieldSign]: yieldUrl,
  [BlockKind.NoEntrySign]: noEntryUrl,
  [BlockKind.OneWaySign]: oneWayUrl,
  [BlockKind.SpeedLimitSign]: speed50Url,
  [BlockKind.PedestrianSign]: pedestrianUrl,
  [BlockKind.SchoolSign]: schoolUrl,
  [BlockKind.ParkingSign]: parkingUrl,
  [BlockKind.DirectionSign]: directionUrl,
  [BlockKind.DangerSign]: dangerUrl,
  [BlockKind.RoundaboutSign]: roundaboutUrl,
  [BlockKind.PrioritySign]: priorityUrl,
};

function resizeSign(mesh: Mesh) {
  const geometry = mesh.geometry.clone();
  mesh.geometry = geometry;
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const positions = geometry.getAttribute('position');
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const boardHalfWidth = Math.max(Math.abs(bounds.min.x - centerX), Math.abs(bounds.max.x - centerX)) * 0.45;
  const height = bounds.max.z - bounds.min.z;
  const searchLimit = bounds.min.z + height * 0.65;
  let split = bounds.min.z + height * 0.55;
  for (let i = 0; i < positions.count; i++) {
    const z = positions.getZ(i);
    if (z <= searchLimit && Math.abs(positions.getX(i) - centerX) >= boardHalfWidth) split = Math.max(split, z);
  }
  const centerZ = (bounds.min.z + split) / 2;
  const resizedSplit = centerZ + (split - centerZ) * 0.75;
  for (let i = 0; i < positions.count; i++) {
    const z = positions.getZ(i);
    if (z <= split) {
      positions.setX(i, centerX + (positions.getX(i) - centerX) * 0.75);
      positions.setZ(i, centerZ + (z - centerZ) * 0.75);
    } else {
      positions.setZ(i, resizedSplit + (z - split) * 1.5);
    }
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

export function TrafficSignModel({ kind, held = false, wallMounted = false }: { kind: BlockKind; held?: boolean; wallMounted?: boolean }) {
  const [scene, setScene] = useState<Group | null>(null);
  useEffect(() => {
    let active = true;
    new GLTFLoader().load(models[kind]!, (gltf) => {
      if (active) setScene(gltf.scene);
    }, undefined, (error) => console.error('Chargement du panneau routier impossible', error));
    return () => { active = false; };
  }, [kind]);
  const model = useMemo(() => {
    if (!scene) return null;
    const clone = scene.clone(true);
    clone.rotation.y = held || wallMounted ? 0 : Math.PI;
    clone.traverse((object) => {
      if (object.type !== 'Mesh') return;
      const mesh = object as Mesh;
      resizeSign(mesh);
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        material.side = FrontSide;
        const map = (material as import('three').MeshStandardMaterial).map;
        if (map) {
          map.magFilter = NearestFilter;
          map.minFilter = NearestFilter;
          map.generateMipmaps = false;
          map.needsUpdate = true;
        }
      }
    });
    const bounds = new Box3().setFromObject(clone);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const scale = (held ? 2.2 : 5) / Math.max(size.y, 0.001);
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    return clone;
  }, [scene, held, wallMounted]);
  return <group name={`traffic-sign-${kind}`} userData={{ trafficSign: kind }}>{model && <primitive object={model} />}</group>;
}
