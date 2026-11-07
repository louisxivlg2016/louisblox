import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) throw new Error('AI3D_SECRET_ID et AI3D_SECRET_KEY sont requis dans .env');
const client = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const directory = '.tmp/hunyuan-player-references';
const statePath = '.tmp/hunyuan-player-reference-jobs.json';
await mkdir(directory, { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const assets = [
  {
    name: 'footballer',
    image: '/home/louisxiv/louisblox/image/joueur-de-foot.jpeg',
    prompt: 'Voxel football player from reference, blond hair on top, one head with one front face, blue number 10 jersey, white shorts, blue socks. No rear face or extra limbs.',
  },
  {
    name: 'pirate',
    image: '/home/louisxiv/louisblox/image/pirate-chef.jpeg',
    prompt: 'Voxel pirate captain from reference, black gold tricorn with feather, red gold coat, beard, one head with one front face. No rear face, extra heads or extra limbs.',
  },
  {
    name: 'soldier',
    image: '/home/louisxiv/louisblox/image/soldat-perfil.jpeg',
    prompt: 'Voxel Napoleonic soldier from reference, black bicorne, blue and red uniform, white cross belts and trousers, one head with one front face. No rear face or extra limbs.',
  },
  {
    name: 'referee',
    image: '/home/louisxiv/louisblox/image/arbitre.jpg',
    prompt: 'Voxel football referee from reference, brown hair, one head with one front face, black uniform with white stripes, whistle, black shorts and boots. No rear face or extra limbs.',
  },
];
const only = process.argv.indexOf('--only');
const requested = new Set((only >= 0 ? process.argv[only + 1] ?? '' : '').split(',').filter(Boolean));
const selected = assets.filter((asset) => requested.size === 0 || requested.has(asset.name));
if (process.argv.includes('--force')) {
  for (const asset of selected) delete state[asset.name];
} else if (process.argv.includes('--retry')) {
  for (const asset of selected) if (state[asset.name]?.status === 'FAIL') delete state[asset.name];
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const save = () => Bun.write(statePath, JSON.stringify(state, null, 2));

async function submit(asset) {
  if (state[asset.name]?.status === 'DONE' && await Bun.file(`${directory}/full-${asset.name}.glb`).exists()) {
    console.log(`${asset.name}: déjà prêt`);
    return;
  }
  if (state[asset.name]?.jobId) return;
  if (asset.prompt.length > 200) throw new Error(`${asset.name}: prompt trop long`);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const result = await client.request('SubmitHunyuanTo3DRapidJob', {
        ImageBase64: Buffer.from(await Bun.file(asset.image).arrayBuffer()).toString('base64'),
        ResultFormat: 'GLB',
        EnablePBR: false,
      });
      state[asset.name] = { jobId: result.JobId, status: 'SUBMITTED', image: asset.image, prompt: asset.prompt };
      await save();
      console.log(`${asset.name}: job ${result.JobId}`);
      return;
    } catch (error) {
      if (error.code !== 'RequestLimitExceeded.JobNumExceed' || attempt === 59) throw error;
      console.log(`${asset.name}: attente d’un emplacement de génération`);
      await sleep(10000);
    }
  }
}

async function download(asset) {
  if (state[asset.name]?.status === 'DONE' && await Bun.file(`${directory}/full-${asset.name}.glb`).exists()) return;
  const jobId = state[asset.name]?.jobId;
  if (!jobId) throw new Error(`${asset.name}: aucun job Hunyuan`);
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
  if (!file?.Url) throw new Error(`${asset.name}: aucun fichier GLB`);
  const response = await fetch(file.Url);
  if (!response.ok) throw new Error(`${asset.name}: téléchargement ${response.status}`);
  const raw = `${directory}/${asset.name}-raw.glb`;
  await Bun.write(raw, await response.arrayBuffer());
  state[asset.name].status = 'DOWNLOADED';
  await save();
  const output = `${directory}/full-${asset.name}.glb`;
  const result = Bun.spawnSync({
    cmd: ['bunx', '@gltf-transform/cli', 'optimize', raw, output, '--texture-compress', 'webp', '--texture-size', '256', '--simplify-error', '0.005', '--no-compress'],
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (result.exitCode !== 0) throw new Error(`${asset.name}: optimisation du GLB échouée`);
  state[asset.name].status = 'DONE';
  await save();
  console.log(`${asset.name}: modèle Hunyuan optimisé depuis son image de référence`);
}

let failed = false;
for (const asset of selected) {
  if (state[asset.name]?.status === 'FAIL') continue;
  try {
    await submit(asset);
    await download(asset);
  } catch (error) {
    failed = true;
    state[asset.name] = { ...state[asset.name], status: 'FAIL', error: String(error) };
    await save();
    console.error(`${asset.name}: ${error}`);
  }
}
console.log(`${selected.filter((asset) => state[asset.name]?.status === 'DONE').length}/${selected.length} modèles prêts`);
if (failed) process.exitCode = 1;
