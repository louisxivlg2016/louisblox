import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir, rename, unlink } from 'node:fs/promises';

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
const statePath = '.tmp/hunyuan-reference-jobs.json';
await mkdir('assets/models', { recursive: true });
await mkdir('.tmp', { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const assets = [
  { name: 'airplane', image: 'assets/references/airplane.png' },
  { name: 'train', image: 'assets/references/train.png' },
  { name: 'blueCar', image: 'assets/references/blueCar.png' },
  { name: 'raceCar', image: 'assets/references/raceCar.png' },
];

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

async function generate(asset) {
  const raw = `assets/models/${asset.name}-reference-raw.glb`;
  const optimized = `assets/models/${asset.name}-reference.glb`;
  const output = `assets/models/${asset.name}.glb`;
  if (await Bun.file(optimized).exists()) {
    await rename(optimized, output);
    console.log(`${asset.name}: modèle de référence déjà optimisé`);
    return;
  }
  if (state[asset.name]?.status === 'DONE' && !await Bun.file(raw).exists() && await Bun.file(output).exists()) {
    console.log(`${asset.name}: modèle de référence déjà téléchargé`);
    return;
  }

  let jobId = state[asset.name]?.jobId;
  if (!jobId) {
    const submitted = await submit(asset);
    jobId = submitted.JobId;
    state[asset.name] = { jobId, status: 'SUBMITTED' };
    await Bun.write(statePath, JSON.stringify(state, null, 2));
    console.log(`${asset.name}: job ${jobId}`);
  }

  let files;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await client.request('QueryHunyuanTo3DRapidJob', { JobId: jobId });
    if (result.Status === 'DONE') {
      files = result.ResultFile3Ds;
      break;
    }
    if (result.Status === 'FAIL') {
      state[asset.name].status = 'FAIL';
      await Bun.write(statePath, JSON.stringify(state, null, 2));
      throw new Error(`${asset.name}: ${result.ErrorMessage}`);
    }
    console.log(`${asset.name}: ${result.Status}`);
    await sleep(5000);
  }
  if (!files) throw new Error(`${asset.name}: délai de génération dépassé`);
  const file = files.find((entry) => (entry.Type || '').toUpperCase() === 'GLB') || files[0];
  const response = await fetch(file.Url);
  if (!response.ok) throw new Error(`${asset.name}: téléchargement ${response.status}`);
  await Bun.write(raw, await response.arrayBuffer());
  state[asset.name].status = 'DONE';
  await Bun.write(statePath, JSON.stringify(state, null, 2));
  console.log(`${asset.name}: GLB téléchargé depuis l’image de référence`);

  const result = Bun.spawnSync({
    cmd: ['bunx', '@gltf-transform/cli', 'optimize', raw, optimized, '--texture-compress', 'webp', '--texture-size', '256', '--simplify-error', '0.003', '--no-compress'],
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (result.exitCode !== 0) throw new Error(`${asset.name}: optimisation échouée`);
  await rename(optimized, output);
  await unlink(raw);
  console.log(`${asset.name}: modèle optimisé et installé`);
}

for (const asset of [...assets].sort((a, b) => Number(Boolean(state[b.name]?.jobId)) - Number(Boolean(state[a.name]?.jobId)))) {
  await generate(asset);
}
console.log('Les quatre modèles issus des images sont prêts.');
