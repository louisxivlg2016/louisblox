import { Box3, BoxGeometry, BufferGeometry, Group, MathUtils, Mesh, Vector3 } from 'three';
import type { Material, Object3D } from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { animalMaterial } from './animalTextures';
import type { OutfitKind } from './outfits';

type Part = 'body' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
type Rig = Partial<Record<Exclude<Part, 'body'>, Group>>;

function splitGeometry(source: BufferGeometry, matrix: import('three').Matrix4, material: Material, width: number, height: number, floor: number, legs: boolean) {
  const geometry = source.clone().applyMatrix4(matrix);
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  const indices: Record<Part, number[]> = { body: [], leftArm: [], rightArm: [], leftLeg: [], rightLeg: [] };
  const count = index?.count ?? position.count;
  for (let offset = 0; offset < count; offset += 3) {
    const a = index?.getX(offset) ?? offset;
    const b = index?.getX(offset + 1) ?? offset + 1;
    const c = index?.getX(offset + 2) ?? offset + 2;
    const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
    const y = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
    const side = x < 0 ? 'left' : 'right';
    let part: Part = 'body';
    if (Math.abs(x) > width * 0.25 && y > floor + height * 0.28 && y < floor + height * 0.82) part = `${side}Arm`;
    else if (legs && Math.abs(x) < width * 0.28 && y < floor + height * 0.48) part = `${side}Leg`;
    indices[part].push(a, b, c);
  }
  return { geometry, indices, material };
}

function addPrincessHair(root: Group, width: number, height: number, depth: number, floor: number) {
  const hair = new Group();
  hair.name = 'princess-back-hair';
  const material = animalMaterial('#5a321c');
  const back = new Mesh(new BoxGeometry(width * 0.32, height * 0.28, depth * 0.14), material);
  back.position.set(0, floor + height * 0.76, -depth * 0.55);
  hair.add(back);
  const crown = new Mesh(new BoxGeometry(width * 0.31, height * 0.075, depth * 0.56), material);
  crown.position.set(0, floor + height * 0.89, 0);
  hair.add(crown);
  for (const side of [-1, 1]) {
    const strand = new Mesh(new BoxGeometry(width * 0.1, height * 0.26, depth * 0.12), animalMaterial('#704126'));
    strand.position.set(side * width * 0.12, floor + height * 0.68, -depth * 0.62);
    hair.add(strand);
  }
  root.add(hair);
  const sides = new Group();
  sides.name = 'princess-side-hair';
  for (const side of [-1, 1]) {
    const panel = new Mesh(new BoxGeometry(width * 0.05, height * 0.28, depth * 1.06), material);
    panel.position.set(side * width * 0.35, floor + height * 0.76, 0);
    sides.add(panel);
  }
  root.add(sides);
}

export function createCharacterRig(source: Object3D, outfit: Exclude<OutfitKind, 'default'>, scale: number) {
  const scene = SkeletonUtils.clone(source);
  scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(scene);
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;
  const floor = bounds.min.y;
  const pieces: Array<ReturnType<typeof splitGeometry>> = [];
  scene.traverse((object) => {
    if (object instanceof Mesh && !Array.isArray(object.material)) pieces.push(splitGeometry(object.geometry, object.matrixWorld, object.material, width, height, floor, outfit !== 'princess'));
  });
  const root = new Group();
  const rig: Rig = {};
  const names: Record<Part, string> = { body: 'body', leftArm: 'left-arm', rightArm: 'right-arm', leftLeg: 'left-leg', rightLeg: 'right-leg' };
  const parts: Part[] = ['body', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
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
        const pivotY = floor + height * (part.endsWith('Arm') ? 0.7 : 0.48);
        const pivotX = side * width * (part.endsWith('Arm') ? 0.27 : 0.12);
        subset.translate(-pivotX, -pivotY, 0);
        const pivot = new Group();
        pivot.name = names[part];
        pivot.position.set(pivotX, pivotY, 0);
        pivot.add(mesh);
        root.add(pivot);
        rig[part] = pivot;
      }
    }
  }
  if (outfit === 'princess') addPrincessHair(root, width, height, bounds.max.z - bounds.min.z, floor);
  root.userData.rig = rig;
  const center = bounds.getCenter(new Vector3());
  root.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  return root;
}

function turn(object: Group | undefined, target: number, delta: number) {
  if (object) object.rotation.x = MathUtils.damp(object.rotation.x, target, 14, delta);
}

export function animateCharacterRig(root: Object3D, time: number, walking: boolean, jumping: boolean, seated: boolean, delta: number) {
  const rig = root.userData.rig as Rig | undefined;
  if (!rig) return;
  const moving = walking && !jumping && !seated;
  const swing = moving ? Math.sin(time * 8) * 0.42 : 0;
  turn(rig.leftArm, swing, delta);
  turn(rig.rightArm, -swing, delta);
  turn(rig.leftLeg, -swing * 0.85, delta);
  turn(rig.rightLeg, swing * 0.85, delta);
}
