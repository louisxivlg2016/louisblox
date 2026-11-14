const input = 'assets/models/airplane.glb';
const output = 'assets/models/airplane.glb';
const texture = '.tmp/airplane-no-windows-final.png';
const glb = Buffer.from(await Bun.file(input).arrayBuffer());
const jsonLength = glb.readUInt32LE(12);
const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
const binHeader = 20 + jsonLength;
const binLength = glb.readUInt32LE(binHeader);
const bin = glb.subarray(binHeader + 8, binHeader + 8 + binLength);
const imageView = document.images[0].bufferView;
const replacement = Buffer.from(await Bun.file(texture).arrayBuffer());
const chunks = [];
let offset = 0;
for (const [index, view] of document.bufferViews.map((view, index) => [index, view]).sort((a, b) => a[1].byteOffset - b[1].byteOffset)) {
  const padding = (4 - offset % 4) % 4;
  if (padding) {
    chunks.push(Buffer.alloc(padding));
    offset += padding;
  }
  const content = index === imageView ? replacement : bin.subarray(view.byteOffset, view.byteOffset + view.byteLength);
  chunks.push(content);
  view.byteOffset = offset;
  view.byteLength = content.length;
  offset += content.length;
}
const nextBin = Buffer.concat(chunks, offset);
document.buffers[0].byteLength = offset;
document.images[0].mimeType = 'image/png';
const json = Buffer.from(JSON.stringify(document));
const jsonPadding = (4 - json.length % 4) % 4;
const binPadding = (4 - nextBin.length % 4) % 4;
const nextJson = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]);
const nextBinPadded = Buffer.concat([nextBin, Buffer.alloc(binPadding)]);
const header = glb.subarray(0, 12);
header.writeUInt32LE(12 + 8 + nextJson.length + 8 + nextBinPadded.length, 8);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(nextJson.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);
const binChunkHeader = Buffer.alloc(8);
binChunkHeader.writeUInt32LE(nextBinPadded.length, 0);
binChunkHeader.writeUInt32LE(0x004e4942, 4);
await Bun.write(output, Buffer.concat([header, jsonHeader, nextJson, binChunkHeader, nextBinPadded]));
console.log(`${output}: texture remplacée (${replacement.length} octets)`);
