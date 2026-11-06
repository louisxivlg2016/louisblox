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
const statePath = '.tmp/hunyuan-costume-v5-jobs.json';
const directory = '.tmp/hunyuan-costume-v5';
await mkdir(directory, { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const assets = [
  { name: 'footballer', image: '/home/louisxiv/Downloads/Gemini_Generated_Image_zco18gzco18gzco1.jpeg' },
  { name: 'pirate', image: '/home/louisxiv/Downloads/Gemini_Generated_Image_6ub7bs6ub7bs6ub7.jpeg' },
  { name: 'police', image: '/home/louisxiv/Downloads/Gemini_Generated_Image_5xivvo5xivvo5xiv.jpeg' },
  { name: 'firefighter', image: '/home/louisxiv/Downloads/Gemini_Generated_Image_gu5grngu5grngu5g.jpeg' },
  { name: 'soldier', image: '/home/louisxiv/Downloads/Gemini_Generated_Image_4lgxug4lgxug4lgx.jpeg' },
];
const only = process.argv.indexOf('--only');
const requested = new Set((only >= 0 ? process.argv[only + 1] ?? '' : '').split(',').filter(Boolean));
if (process.argv.includes('--retry')) {
  for (const asset of assets) {
    if (state[asset.name]?.status === 'FAIL') delete state[asset.name];
  }
}

async function saveState() {
  await Bun.write(statePath, JSON.stringify(state, null, 2));
}

async function submit(asset) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      return await client.request('SubmitHunyuanTo3DRapidJob', {
        ImageBase64: Buffer.from(await Bun.file(asset.image).arrayBuffer()).toString('base64'),
        ResultFormat: 'GLB',
        EnablePBR: false,
      });
    } catch (error) {
      if (error.code !== 'RequestLimitExceeded.JobNumExceed' || attempt === 29) throw error;
      console.log(`${asset.name}: attente d’un emplacement de génération`);
      await sleep(10000);
    }
  }
  throw new Error(`${asset.name}: impossible de soumettre le modèle`);
}

async function optimize(asset) {
  const raw = `${directory}/${asset.name}-raw.glb`;
  const output = `${directory}/full-${asset.name}.glb`;
  const result = Bun.spawnSync({
    cmd: ['bunx', '@gltf-transform/cli', 'optimize', raw, output, '--texture-compress', 'webp', '--texture-size', '256', '--simplify-error', '0.005', '--no-compress'],
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (result.exitCode !== 0) throw new Error(`${asset.name}: optimisation du GLB échouée`);
  state[asset.name].status = 'DONE';
  await saveState();
  console.log(`${asset.name}: modèle Hunyuan optimisé depuis son image de référence`);
}

async function generate(asset) {
  const output = `${directory}/full-${asset.name}.glb`;
  if (state[asset.name]?.status === 'DONE' && await Bun.file(output).exists()) {
    console.log(`${asset.name}: déjà prêt`);
    return;
  }
  try {
    if (state[asset.name]?.status === 'DOWNLOADED' && await Bun.file(`${directory}/${asset.name}-raw.glb`).exists()) {
      await optimize(asset);
      return;
    }
    if (!state[asset.name]?.jobId) {
      const submitted = await submit(asset);
      state[asset.name] = { jobId: submitted.JobId, status: 'SUBMITTED', image: asset.image };
      await saveState();
      console.log(`${asset.name}: job ${submitted.JobId}`);
    }
    const jobId = state[asset.name].jobId;
    let files;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const result = await client.request('QueryHunyuanTo3DRapidJob', { JobId: jobId });
      if (result.Status === 'DONE') {
        files = result.ResultFile3Ds;
        break;
      }
      if (result.Status === 'FAIL') throw new Error(result.ErrorMessage || 'La génération Hunyuan a échoué');
      if (attempt % 6 === 0) console.log(`${asset.name}: ${result.Status}`);
      await sleep(5000);
    }
    if (!files) throw new Error(`${asset.name}: délai de génération dépassé`);
    const file = files.find((entry) => (entry.Type || '').toUpperCase() === 'GLB') || files[0];
    if (!file?.Url) throw new Error(`${asset.name}: aucun GLB dans le résultat`);
    const response = await fetch(file.Url);
    if (!response.ok) throw new Error(`${asset.name}: téléchargement ${response.status}`);
    await Bun.write(`${directory}/${asset.name}-raw.glb`, await response.arrayBuffer());
    state[asset.name].status = 'DOWNLOADED';
    await saveState();
    await optimize(asset);
  } catch (error) {
    state[asset.name] = { ...state[asset.name], status: 'FAIL', error: String(error) };
    await saveState();
    console.error(`${asset.name}: ${error}`);
  }
}

for (const asset of assets) {
  if (requested.size === 0 || requested.has(asset.name)) await generate(asset);
}
const ready = [];
for (const asset of assets) {
  if (requested.size > 0 && !requested.has(asset.name)) continue;
  if (state[asset.name]?.status === 'DONE' && await Bun.file(`${directory}/full-${asset.name}.glb`).exists()) ready.push(asset.name);
}
console.log(`${ready.length}/${requested.size || assets.length} costumes issus des images sont prêts`);
if (ready.length !== (requested.size || assets.length)) process.exitCode = 1;
