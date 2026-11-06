import { Box3, BoxGeometry, BufferGeometry, Group, MathUtils, Mesh, Vector3 } from 'three';
import type { Material, Object3D } from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { animalMaterial } from './animalTextures';
import { colorCharacterMaterial } from './characterAppearance';
import type { CharacterAppearance } from './appearance';
import type { OutfitKind } from './outfits';

type Part = 'body' | 'head' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
type Rig = Partial<Record<Exclude<Part, 'body'>, Group>>;

function splitGeometry(source: BufferGeometry, matrix: import('three').Matrix4, material: Material, width: number, height: number, floor: number, legs: boolean, bounds: Box3, appearance?: Pick<CharacterAppearance, 'skinColor' | 'hairColor' | 'eyeColor' | 'eyebrowColor' | 'originalHairColor'>, allowGrayHair = false, princessHair = false, outfit?: OutfitKind) {
  const geometry = source.clone().applyMatrix4(matrix);
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  const indices: Record<Part, number[]> = { body: [], head: [], leftArm: [], rightArm: [], leftLeg: [], rightLeg: [] };
  const count = index?.count ?? position.count;
  for (let offset = 0; offset < count; offset += 3) {
    const a = index?.getX(offset) ?? offset;
    const b = index?.getX(offset + 1) ?? offset + 1;
    const c = index?.getX(offset + 2) ?? offset + 2;
    const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
    const y = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
    const side = x < 0 ? 'left' : 'right';
    let part: Part = 'body';
    if (Math.abs(x) < width * 0.38 && y > floor + height * 0.68) part = 'head';
    else if (Math.abs(x) > width * 0.25 && y > floor + height * 0.28 && y < floor + height * 0.82) part = `${side}Arm`;
    else if (legs && Math.abs(x) < width * 0.28 && y < floor + height * 0.48) part = `${side}Leg`;
    indices[part].push(a, b, c);
  }
  return { geometry, indices, material: appearance ? colorCharacterMaterial(material, geometry, bounds, appearance, allowGrayHair, princessHair, outfit) : material };
}

function addPrincessHair(root: Group, width: number, height: number, depth: number, floor: number, offsetY: number, hairColor?: string) {
  const hair = new Group();
  hair.name = 'princess-back-hair';
  hair.position.y = offsetY;
  const material = animalMaterial(hairColor ?? '#5a321c');
  const back = new Mesh(new BoxGeometry(width * 0.32, height * 0.28, depth * 0.14), material);
  back.position.set(0, floor + height * 0.76, -depth * 0.55);
  hair.add(back);
  const crown = new Mesh(new BoxGeometry(width * 0.31, height * 0.075, depth * 0.56), material);
  crown.position.set(0, floor + height * 0.89, 0);
  hair.add(crown);
  for (const side of [-1, 1]) {
    const strand = new Mesh(new BoxGeometry(width * 0.1, height * 0.26, depth * 0.12), material);
    strand.position.set(side * width * 0.12, floor + height * 0.68, -depth * 0.62);
    hair.add(strand);
  }
  root.add(hair);
}

export function createCharacterRig(source: Object3D, outfit: Exclude<OutfitKind, 'default'>, scale: number, appearance?: Pick<CharacterAppearance, 'skinColor' | 'hairColor' | 'eyeColor' | 'eyebrowColor' | 'originalHairColor'>) {
  const scene = SkeletonUtils.clone(source);
  scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(scene);
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;
  const floor = bounds.min.y;
  const pieces: Array<ReturnType<typeof splitGeometry>> = [];
  scene.traverse((object) => {
    if (object instanceof Mesh && !Array.isArray(object.material)) pieces.push(splitGeometry(object.geometry, object.matrixWorld, object.material, width, height, floor, outfit !== 'princess', bounds, appearance, outfit === 'louis15', outfit === 'princess', outfit));
  });
  const root = new Group();
  const rig: Rig = {};
  const names: Record<Part, string> = { body: 'body', head: 'head', leftArm: 'left-arm', rightArm: 'right-arm', leftLeg: 'left-leg', rightLeg: 'right-leg' };
  const parts: Part[] = ['body', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
  for (const part of parts) {
    for (const piece of pieces) {
      const indices = piece.indices[part];
      if (indices.length === 0) continue;
      const subset = piece.geometry.clone();
      subset.setIndex(indices);
      const mesh = new Mesh(subset, piece.material);
      if (part === 'body') {
        root.add(mesh);
      } else {
        const side = part.startsWith('left') ? -1 : 1;
        const pivotY = floor + height * (part === 'head' ? 0.68 : part.endsWith('Arm') ? 0.7 : 0.48);
        const pivotX = part === 'head' ? 0 : side * width * (part.endsWith('Arm') ? 0.27 : 0.12);
        let pivot = rig[part];
        if (!pivot) {
          pivot = new Group();
          pivot.name = names[part];
          pivot.position.set(pivotX, pivotY, 0);
          root.add(pivot);
          rig[part] = pivot;
        }
        subset.translate(-pivotX, -pivotY, 0);
        pivot.add(mesh);
      }
    }
  }
  if (outfit === 'princess') addPrincessHair(rig.head ?? root, width, height, bounds.max.z - bounds.min.z, floor, rig.head ? -(floor + height * 0.68) : 0, appearance?.hairColor);
  root.userData.rig = rig;
  const center = bounds.getCenter(new Vector3());
  root.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  return root;
}

function turn(object: Group | undefined, target: number, delta: number) {
  if (object) object.rotation.x = MathUtils.damp(object.rotation.x, target, 14, delta);
}

export function animateCharacterRig(root: Object3D, time: number, walking: boolean, jumping: boolean, seated: boolean, delta: number, eating?: { startedAt: number } | null) {
  const rig = root.userData.rig as Rig | undefined;
  if (!rig) return;
  const moving = walking && !jumping && !seated;
  const swing = moving ? Math.sin(time * 8) * 0.42 : 0;
  const bite = eating ? Math.sin(Math.min(1, (performance.now() - eating.startedAt) / 850) * Math.PI) : 0;
  turn(rig.leftArm, swing, delta);
  if (rig.rightArm && eating) rig.rightArm.rotation.x = 1.25 + bite * 0.65;
  else turn(rig.rightArm, -swing, delta);
  turn(rig.leftLeg, -swing * 0.85, delta);
  turn(rig.rightLeg, swing * 0.85, delta);
}

export function attachCharacterHand(avatar: Object3D | null, hand: Group | null, fullCharacter: boolean) {
  if (!hand) return fullCharacter;
  if (!fullCharacter) {
    if (avatar && hand.parent !== avatar) {
      avatar.add(hand);
      hand.position.set(0.39, 1.4, 0);
      hand.rotation.set(0, 0, 0);
      hand.scale.setScalar(1);
    }
    return false;
  }
  const rig = avatar?.getObjectByName('full-character')?.getObjectByName('right-arm') as Group | undefined;
  if (!rig || hand.parent === rig) return true;
  const bounds = new Box3();
  const vertex = new Vector3();
  for (const child of rig.children) {
    if (!(child instanceof Mesh)) continue;
    const position = child.geometry.getAttribute('position');
    const index = child.geometry.index;
    if (index) {
      for (let offset = 0; offset < index.count; offset += 1) bounds.expandByPoint(vertex.fromBufferAttribute(position, index.getX(offset)));
    } else {
      child.geometry.computeBoundingBox();
      if (child.geometry.boundingBox) bounds.union(child.geometry.boundingBox);
    }
  }
  if (bounds.isEmpty()) return true;
  const center = bounds.getCenter(new Vector3());
  rig.add(hand);
  hand.position.set(center.x, bounds.min.y + 0.08, 0.24);
  hand.rotation.set(0, 0, 0);
  hand.scale.setScalar(1);
  return true;
}
