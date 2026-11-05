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
const statePath = '.tmp/hunyuan-costume-jobs.json';
await mkdir('.tmp/hunyuan-costumes', { recursive: true });
await mkdir('assets/models', { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const assets = [
  { name: 'pirate', prompt: 'Full body low-poly voxel pirate game avatar, black tricorn hat, dark red pirate coat, white shirt, brown belt and boots, complete human character with head, torso, two arms and two legs, upright standing pose, arms slightly away from torso, clear blocky silhouette, no background, no stand, no text, no other objects' },
  { name: 'footballer', prompt: 'Full body low-poly voxel football player game avatar, blue and white striped football jersey, black shorts, white knee socks, black soccer shoes, complete human character with head, torso, two arms and two legs, upright standing pose, arms slightly away from torso, clear blocky silhouette, no ball, no background, no stand, no text, no other objects' },
  { name: 'firefighter', prompt: 'Full body low-poly voxel firefighter game avatar, yellow helmet, dark navy protective jacket and pants with bright yellow reflective stripes, black gloves and boots, complete human character with head, torso, two arms and two legs, upright standing pose, arms slightly away from torso, clear blocky silhouette, no background, no stand, no text, no other objects' },
  { name: 'police', prompt: 'Full body low-poly voxel police officer game avatar, navy police cap, light blue shirt, dark blue uniform pants, black belt, black shoes and silver badge, complete human character with head, torso, two arms and two legs, upright standing pose, arms slightly away from torso, clear blocky silhouette, no background, no stand, no text, no other objects' },
];
if (process.argv.includes('--retry')) {
  for (const asset of assets) {
    if (state[asset.name]?.status === 'FAIL') delete state[asset.name];
  }
}

async function saveState() {
  await Bun.write(statePath, JSON.stringify(state, null, 2));
}

async function submit(asset) {
  const output = `assets/models/full-${asset.name}.glb`;
  if (await Bun.file(output).exists()) {
    state[asset.name] = { ...state[asset.name], status: 'DONE' };
    console.log(`${asset.name}: déjà prêt`);
    return;
  }
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      if (!state[asset.name]?.jobId) {
        const result = await client.request('SubmitHunyuanTo3DRapidJob', { Prompt: asset.prompt, ResultFormat: 'GLB', EnablePBR: false });
        state[asset.name] = { jobId: result.JobId, status: 'SUBMITTED' };
        await saveState();
        console.log(`${asset.name}: job ${result.JobId}`);
      }
      return;
    } catch (error) {
      if (error.code === 'RequestLimitExceeded.JobNumExceed' && attempt < 29) {
        await sleep(5000);
        continue;
      }
      state[asset.name] = { ...state[asset.name], status: 'FAIL', error: String(error) };
      await saveState();
      console.error(`${asset.name}: ${error}`);
      return;
    }
  }
}

async function download(asset) {
  const output = `assets/models/full-${asset.name}.glb`;
  if (await Bun.file(output).exists()) return;
  const jobId = state[asset.name]?.jobId;
  if (!jobId) return;
  try {
    let files;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const result = await client.request('QueryHunyuanTo3DRapidJob', { JobId: jobId });
      if (result.Status === 'DONE') {
        files = result.ResultFile3Ds;
        break;
      }
      if (result.Status === 'FAIL') throw new Error(result.ErrorMessage || 'La génération a échoué');
      if (attempt % 6 === 0) console.log(`${asset.name}: ${result.Status}`);
      await sleep(5000);
    }
    if (!files) throw new Error('Délai de génération dépassé');
    const file = files.find((entry) => (entry.Type || '').toUpperCase() === 'GLB') || files[0];
    if (!file?.Url) throw new Error('Aucun fichier GLB dans le résultat');
    const response = await fetch(file.Url);
    if (!response.ok) throw new Error(`Téléchargement ${response.status}`);
    const raw = `.tmp/hunyuan-costumes/${asset.name}-raw.glb`;
    await Bun.write(raw, await response.arrayBuffer());
    state[asset.name].status = 'DOWNLOADED';
    await saveState();
    const result = Bun.spawnSync({
      cmd: ['bunx', '@gltf-transform/cli', 'optimize', raw, output, '--texture-compress', 'webp', '--texture-size', '256', '--simplify-error', '0.005', '--no-compress'],
      stdout: 'inherit',
      stderr: 'inherit',
    });
    if (result.exitCode !== 0) throw new Error('Optimisation du GLB échouée');
    state[asset.name].status = 'DONE';
    await saveState();
    console.log(`${asset.name}: prêt`);
  } catch (error) {
    state[asset.name] = { ...state[asset.name], status: 'FAIL', error: String(error) };
    await saveState();
    console.error(`${asset.name}: ${error}`);
  }
}

for (const asset of assets) await submit(asset);
for (const asset of assets) await download(asset);
const failed = assets.filter((asset) => state[asset.name]?.status !== 'DONE');
console.log(`${assets.length - failed.length}/${assets.length} costumes prêts`);
if (failed.length > 0) process.exitCode = 1;
else await import('./normalize-hunyuan-costumes.mjs');
