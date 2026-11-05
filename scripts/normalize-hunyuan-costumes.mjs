import { fullCharacterHeights } from '../src/game/fullCharacters';

const names = ['pirate', 'footballer', 'firefighter', 'police'];
const targetHeight = 1.9000003337860107;
const heights = { ...fullCharacterHeights };

for (const name of names) {
  const path = `assets/models/full-${name}.glb`;
  const input = await Bun.file(path).arrayBuffer();
  const buffer = Buffer.from(input);
  const jsonLength = buffer.readUInt32LE(12);
  const document = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
  const positionAccessors = new Set(document.meshes.flatMap((mesh) => mesh.primitives.map((primitive) => primitive.attributes.POSITION)));
  const bounds = [...positionAccessors].map((index) => document.accessors[index]);
  if (bounds.length === 0 || bounds.some((accessor) => !accessor.min || !accessor.max)) throw new Error(`${name}: limites de position absentes`);
  const sourceFloor = Math.min(...bounds.map((accessor) => accessor.min[2]));
  const sourceHeight = Math.max(...bounds.map((accessor) => accessor.max[2])) - sourceFloor;
  const scale = targetHeight / sourceHeight;
  const binLength = buffer.readUInt32LE(20 + jsonLength);
  const binary = Buffer.from(buffer.subarray(28 + jsonLength, 28 + jsonLength + binLength));
  const width = Math.max(...bounds.map((accessor) => accessor.max[0])) - Math.min(...bounds.map((accessor) => accessor.min[0]));
  for (const index of positionAccessors) {
    const accessor = document.accessors[index];
    const view = document.bufferViews[accessor.bufferView];
    if (accessor.componentType !== 5126 || accessor.type !== 'VEC3') throw new Error(`${name}: positions inattendues`);
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const stride = view.byteStride ?? 12;
    for (let vertex = 0; vertex < accessor.count; vertex += 1) {
      const offset = start + vertex * stride;
      binary.writeFloatLE(binary.readFloatLE(offset) * scale, offset);
      binary.writeFloatLE(binary.readFloatLE(offset + 4) * scale, offset + 4);
      binary.writeFloatLE(binary.readFloatLE(offset + 8) * scale, offset + 8);
    }
    accessor.min = accessor.min.map((value, axis) => value * scale);
    accessor.max = accessor.max.map((value, axis) => value * scale);
  }
  heights[name] = targetHeight;
  const json = Buffer.from(JSON.stringify(document));
  const paddedJson = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(paddedJson);
  const output = Buffer.alloc(28 + paddedJson.length + binary.length);
  output.write('glTF', 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(paddedJson.length, 12);
  output.write('JSON', 16);
  paddedJson.copy(output, 20);
  output.writeUInt32LE(binary.length, 20 + paddedJson.length);
  output.write('BIN\0', 24 + paddedJson.length);
  binary.copy(output, 28 + paddedJson.length);
  await Bun.write(path, output);
  console.log(`${name}: hauteur ${sourceHeight.toFixed(4)} → ${(sourceHeight * scale).toFixed(4)}, largeur ${(width * scale).toFixed(4)}`);
}
await Bun.write('src/game/fullCharacters.ts', `export const fullCharacterHeights: Record<string, number> = ${JSON.stringify(heights, null, 2)};\n`);
