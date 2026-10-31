import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) {
  throw new Error('AI3D_SECRET_ID et AI3D_SECRET_KEY sont requis dans .env');
}

const client = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const statePath = '.tmp/hunyuan-wardrobe-jobs.json';
await mkdir('.tmp/hunyuan-wardrobe', { recursive: true });
await mkdir('assets/models', { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const assets = [
  { name: 'wig-louis14', prompt: 'Voxel Louis XIV wig, tall dark brown curls, side ringlets and long back curls, no head, no face, no stand, low-poly pixelated game accessory' },
  { name: 'wig-louis15', prompt: 'Voxel Louis XV wig, short powdered white curls and small ponytail, no head, no face, no stand, low-poly pixelated game accessory' },
  { name: 'costume-king', prompt: 'Voxel red royal coat for blocky game avatar, torso and short sleeves, gold buttons, white collar, no person, no head, no legs, no stand' },
  { name: 'costume-military', prompt: 'Voxel green military uniform for blocky game avatar, torso, short sleeves and vest, no person, no head, no legs, no stand' },
  { name: 'costume-knight', prompt: 'Low-poly voxel silver knight chest armor, front and back plates with shoulder guards, empty garment, isolated game asset' },
  { name: 'costume-explorer', prompt: 'Low-poly voxel brown travel jacket with short sleeves and shoulder straps, isolated clothing game asset' },
  { name: 'costume-princess', prompt: 'Low-poly voxel pink formal bodice with gold edging and puffed short sleeves, isolated clothing game asset' },
  { name: 'costume-louis14', prompt: 'Low-poly voxel navy blue ceremonial coat with gold buttons and white collar, isolated clothing game asset' },
  { name: 'costume-louis15', prompt: 'Low-poly voxel pale blue ceremonial coat with silver buttons and white collar, isolated clothing game asset' },
];
if (process.argv.includes('--retry')) {
  for (const asset of assets) {
    if (state[asset.name]?.status === 'FAIL') delete state[asset.name];
  }
}

async function saveState() {
  await Bun.write(statePath, JSON.stringify(state, null, 2));
}

for (const asset of [...assets].sort((a, b) => Number(Boolean(state[b.name]?.jobId)) - Number(Boolean(state[a.name]?.jobId)))) {
  const raw = `.tmp/hunyuan-wardrobe/${asset.name}-raw.glb`;
  const output = `assets/models/${asset.name}.glb`;
  if (await Bun.file(output).exists()) {
    state[asset.name] = { ...state[asset.name], status: 'DONE' };
    console.log(`${asset.name}: déjà prêt`);
    continue;
  }
  try {
    let jobId = state[asset.name]?.jobId;
    if (!jobId) {
      const submitted = await client.request('SubmitHunyuanTo3DRapidJob', {
        Prompt: asset.prompt,
        ResultFormat: 'GLB',
        EnablePBR: false,
      });
      jobId = submitted.JobId;
      state[asset.name] = { jobId, status: 'SUBMITTED' };
      await saveState();
      console.log(`${asset.name}: job ${jobId}`);
    }
    let files;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const result = await client.request('QueryHunyuanTo3DRapidJob', { JobId: jobId });
      if (result.Status === 'DONE') {
        files = result.ResultFile3Ds;
        break;
      }
      if (result.Status === 'FAIL') throw new Error(result.ErrorMessage || 'La génération a échoué');
      console.log(`${asset.name}: ${result.Status}`);
      await sleep(5000);
    }
    if (!files) throw new Error('Délai de génération dépassé');
    const file = files.find((entry) => (entry.Type || '').toUpperCase() === 'GLB') || files[0];
    if (!file?.Url) throw new Error('Aucun fichier GLB dans le résultat');
    const response = await fetch(file.Url);
    if (!response.ok) throw new Error(`Téléchargement ${response.status}`);
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

const failed = assets.filter((asset) => state[asset.name]?.status !== 'DONE');
console.log(`${assets.length - failed.length}/${assets.length} modèles prêts`);
if (failed.length > 0) process.exitCode = 1;
