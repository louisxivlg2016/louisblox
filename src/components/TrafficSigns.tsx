import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, FrontSide, NearestFilter, Vector3 } from 'three';
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

export function TrafficSignModel({ kind, held = false }: { kind: BlockKind; held?: boolean }) {
  const { scene } = useGLTF(models[kind]!);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.rotation.y = held ? 0 : Math.PI;
    clone.traverse((object) => {
      if (object.type !== 'Mesh') return;
      const mesh = object as import('three').Mesh;
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
  }, [scene, held]);
  return <group name={`traffic-sign-${kind}`} userData={{ trafficSign: kind }}><primitive object={model} /></group>;
}
