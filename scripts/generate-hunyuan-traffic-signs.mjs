import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) throw new Error('AI3D_SECRET_ID et AI3D_SECRET_KEY sont requis dans .env');
const client = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const statePath = '.tmp/hunyuan-traffic-sign-jobs.json';
await mkdir('assets/models', { recursive: true });
await mkdir('.tmp/hunyuan-traffic-signs', { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const assets = [
  { name: 'stop', prompt: 'Minecraft voxel French STOP road sign, red octagonal panel with a clean white border and white STOP letters, simple galvanized gray pole, sign facing forward, low-poly game asset, no background, no other objects' },
  { name: 'yield', prompt: 'Minecraft voxel French yield road sign, inverted triangle with thick red border and clean white center, simple galvanized gray pole, sign facing forward, low-poly game asset, no text, no background' },
  { name: 'no-entry', prompt: 'Minecraft voxel no entry road sign, red circle with a single clean white horizontal rectangular bar in the center, simple galvanized gray pole, sign facing forward, low-poly game asset, no background' },
  { name: 'one-way', prompt: 'Minecraft voxel one way road sign, blue rectangular panel with one large clean white upward arrow, simple galvanized gray pole, sign facing forward, low-poly game asset, no text, no background' },
  { name: 'speed-50', prompt: 'Minecraft voxel speed limit 50 road sign, white circle with thick red border and clean black number 50 in the center, simple galvanized gray pole, sign facing forward, low-poly game asset, no background' },
  { name: 'pedestrian', prompt: 'Minecraft voxel pedestrian crossing road sign, blue square panel with a white triangular warning area and a simple black pedestrian pictogram, simple galvanized gray pole, sign facing forward, low-poly game asset, no text, no background' },
  { name: 'school', prompt: 'Minecraft voxel school children warning road sign, white triangle with thick red border and simple black pictogram of two children walking, simple galvanized gray pole, sign facing forward, low-poly game asset, no text, no background' },
  { name: 'parking', prompt: 'Minecraft voxel parking road sign, blue square panel with a clean white capital letter P in the center, simple galvanized gray pole, sign facing forward, low-poly game asset, no background' },
  { name: 'direction', prompt: 'Minecraft voxel direction road sign, blue rectangular panel with a large clean white straight arrow pointing upward, simple galvanized gray pole, sign facing forward, low-poly game asset, no text, no background' },
  { name: 'danger', prompt: 'Minecraft voxel danger warning road sign, white triangle with thick red border and a clean black exclamation mark, simple galvanized gray pole, sign facing forward, low-poly game asset, no background' },
  { name: 'roundabout', prompt: 'Minecraft voxel roundabout road sign, blue circular panel with three clean white arrows arranged in a circular loop, simple galvanized gray pole, sign facing forward, low-poly game asset, no text, no background' },
  { name: 'priority', prompt: 'Minecraft voxel priority road sign, yellow diamond panel with a clean white border, simple galvanized gray pole, sign facing forward, low-poly game asset, no text, no background' },
];

async function saveState() {
  await Bun.write(statePath, JSON.stringify(state, null, 2));
}

if (process.argv.includes('--retry')) {
  for (const asset of assets) {
    if (state[asset.name]?.status === 'FAIL') delete state[asset.name];
  }
  await saveState();
}

async function submit(asset) {
  const output = `assets/models/traffic-sign-${asset.name}.glb`;
  if (await Bun.file(output).exists()) {
    state[asset.name] = { ...state[asset.name], status: 'DONE' };
    return;
  }
  if (state[asset.name]?.jobId) return;
  try {
    const result = await client.request('SubmitHunyuanTo3DRapidJob', { Prompt: asset.prompt, ResultFormat: 'GLB', EnablePBR: false });
    state[asset.name] = { jobId: result.JobId, status: 'SUBMITTED' };
    await saveState();
    console.log(`${asset.name}: tâche ${result.JobId}`);
  } catch (error) {
    state[asset.name] = { status: 'FAIL', error: String(error) };
    await saveState();
    console.error(`${asset.name}: ${error}`);
  }
}

async function download(asset) {
  const output = `assets/models/traffic-sign-${asset.name}.glb`;
  if (await Bun.file(output).exists()) {
    state[asset.name] = { ...state[asset.name], status: 'DONE' };
    return;
  }
  const jobId = state[asset.name]?.jobId;
  if (!jobId) return;
  const raw = `.tmp/hunyuan-traffic-signs/${asset.name}-raw.glb`;
  try {
    if (!await Bun.file(raw).exists()) {
      let files;
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const result = await client.request('QueryHunyuanTo3DRapidJob', { JobId: jobId });
        if (result.Status === 'DONE') {
          files = result.ResultFile3Ds;
          break;
        }
        if (result.Status === 'FAIL') throw new Error(result.ErrorMessage || 'Échec de la génération');
        if (attempt % 6 === 0) console.log(`${asset.name}: ${result.Status}`);
        await sleep(5000);
      }
      if (!files) throw new Error('Délai de génération dépassé');
      const file = files.find((entry) => (entry.Type || '').toUpperCase() === 'GLB') || files[0];
      if (!file?.Url) throw new Error('Aucun fichier GLB dans le résultat');
      const response = await fetch(file.Url);
      if (!response.ok) throw new Error(`Téléchargement ${response.status}`);
      await Bun.write(raw, await response.arrayBuffer());
    }
    const result = Bun.spawnSync({
      cmd: ['bunx', '@gltf-transform/cli', 'optimize', raw, output, '--texture-compress', 'webp', '--texture-size', '256', '--simplify-error', '0.003', '--no-compress'],
      stdout: 'inherit',
      stderr: 'inherit',
    });
    if (result.exitCode !== 0) throw new Error('Optimisation du GLB échouée');
    state[asset.name] = { ...state[asset.name], status: 'DONE' };
    await saveState();
    console.log(`${asset.name}: modèle prêt`);
  } catch (error) {
    state[asset.name] = { ...state[asset.name], status: 'FAIL', error: String(error) };
    await saveState();
    console.error(`${asset.name}: ${error}`);
  }
}

for (const asset of assets) {
  await submit(asset);
  await download(asset);
  await sleep(1500);
}
const failed = assets.filter((asset) => state[asset.name]?.status !== 'DONE');
console.log(`${assets.length - failed.length}/${assets.length} panneaux prêts`);
if (failed.length > 0) process.exitCode = 1;
