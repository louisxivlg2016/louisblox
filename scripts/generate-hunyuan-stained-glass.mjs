import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir, unlink } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) throw new Error('AI3D_SECRET_ID et AI3D_SECRET_KEY sont requis dans .env');
const client = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const statePath = '.tmp/hunyuan-stained-glass-smooth-jobs.json';
await mkdir('assets/models', { recursive: true });
await mkdir('assets/vitraux', { recursive: true });
await mkdir('.tmp', { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const designs = [
  ['rose', 'High resolution smooth stained glass artwork, red and pink roses, green leaves, thin elegant black lead lines, luminous blue glass, edge-to-edge seamless repeating pattern, full square panel, no frame, no border, no text, crisp details, not pixel art'],
  ['geometric', 'High resolution smooth stained glass artwork, blue and golden Art Deco diamonds, thin black lead lines, symmetrical edge-to-edge repeating pattern, full square panel, no frame, no border, no text, crisp details, not pixel art'],
  ['sun', 'High resolution smooth stained glass artwork, golden orange sun over green hills, thin black lead lines, edge-to-edge seamless repeating pattern, full square panel, no frame, no border, no text, crisp details, not pixel art'],
  ['forest', 'High resolution smooth stained glass artwork, green pine trees and brown trunks, thin black lead lines, edge-to-edge seamless repeating pattern, full square panel, no frame, no border, no text, crisp details, not pixel art'],
  ['ocean', 'High resolution smooth stained glass artwork, turquoise ocean waves and small fish, thin black lead lines, edge-to-edge seamless repeating pattern, full square panel, no frame, no border, no text, crisp details, not pixel art'],
  ['violet', 'High resolution smooth stained glass artwork, purple night sky, crescent moon and stars, thin black lead lines, edge-to-edge seamless repeating pattern, full square panel, no frame, no border, no text, crisp details, not pixel art'],
  ['rainbow', 'High resolution smooth stained glass artwork, colorful rainbow arches, thin black lead lines, edge-to-edge seamless repeating pattern, full square panel, no frame, no border, no text, crisp details, not pixel art'],
  ['dove', 'High resolution smooth stained glass artwork, white dove with colorful glass feathers, thin black lead lines, edge-to-edge seamless repeating pattern, full square panel, no frame, no border, no text, crisp details, not pixel art'],
];

async function generate([name, prompt]) {
  const raw = `assets/models/vitrail-${name}-raw.glb`;
  const output = `assets/models/vitrail-${name}.glb`;
  if (state[name]?.status === 'DONE' && await Bun.file(output).exists() && await Bun.file(`assets/vitraux/${name}-lisse.webp`).exists()) {
    console.log(`${name}: déjà généré`);
    return;
  }
  let jobId = state[name]?.jobId;
  if (!jobId) {
    let submitted;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        submitted = await client.request('SubmitHunyuanTo3DRapidJob', { Prompt: prompt, ResultFormat: 'GLB', EnablePBR: false });
        break;
      } catch (error) {
        if (error.code !== 'RequestLimitExceeded.JobNumExceed' || attempt === 29) throw error;
        await sleep(10000);
      }
    }
    jobId = submitted.JobId;
    state[name] = { jobId, status: 'SUBMITTED' };
    await Bun.write(statePath, JSON.stringify(state, null, 2));
    console.log(`${name}: job ${jobId}`);
  }
  let files;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await client.request('QueryHunyuanTo3DRapidJob', { JobId: jobId });
    if (result.Status === 'DONE') {
      files = result.ResultFile3Ds;
      break;
    }
    if (result.Status === 'FAIL') {
      state[name].status = 'FAIL';
      await Bun.write(statePath, JSON.stringify(state, null, 2));
      throw new Error(`${name}: ${result.ErrorMessage}`);
    }
    console.log(`${name}: ${result.Status}`);
    await sleep(5000);
  }
  if (!files) throw new Error(`${name}: délai de génération dépassé`);
  const file = files.find((entry) => (entry.Type || '').toUpperCase() === 'GLB') || files[0];
  const response = await fetch(file.Url);
  if (!response.ok) throw new Error(`${name}: téléchargement ${response.status}`);
  await Bun.write(raw, await response.arrayBuffer());
  const optimized = Bun.spawnSync({
    cmd: ['bunx', '@gltf-transform/cli', 'optimize', raw, output, '--texture-compress', 'webp', '--texture-size', '1024', '--simplify-error', '0.003', '--no-compress'],
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (optimized.exitCode !== 0) throw new Error(`${name}: optimisation échouée`);
  await unlink(raw);
  const data = await Bun.file(output).arrayBuffer();
  const view = new DataView(data);
  const jsonLength = view.getUint32(12, true);
  const gltf = JSON.parse(new TextDecoder().decode(data.slice(20, 20 + jsonLength)));
  const image = gltf.images[0];
  const bufferView = gltf.bufferViews[image.bufferView];
  const binaryStart = 20 + jsonLength + 8;
  await Bun.write(`assets/vitraux/${name}-lisse.webp`, data.slice(binaryStart + (bufferView.byteOffset ?? 0), binaryStart + (bufferView.byteOffset ?? 0) + bufferView.byteLength));
  state[name].status = 'DONE';
  await Bun.write(statePath, JSON.stringify(state, null, 2));
  console.log(`${name}: vitrail généré et optimisé`);
}

for (let index = 0; index < designs.length; index += 3) {
  await Promise.all(designs.slice(index, index + 3).map(generate));
}
console.log('Les huit dessins de vitraux sont générés.');
