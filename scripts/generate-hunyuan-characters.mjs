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
const statePath = '.tmp/hunyuan-character-jobs.json';
await mkdir('.tmp/hunyuan-characters', { recursive: true });
await mkdir('assets/models', { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const assets = [
  { name: 'costume-louis14-v2', prompt: 'Low-poly voxel ornate Louis XIV royal outfit for a blocky game avatar, navy velvet coat, rich gold embroidery, white lace cravat, decorated cuffs, no person, no head, no legs, no stand' },
  { name: 'costume-louis15-v2', prompt: 'Low-poly voxel elegant Louis XV ceremonial outfit for a blocky game avatar, pale blue brocade coat, silver embroidery, white ruffled collar and cuffs, no person, no head, no legs, no stand' },
  { name: 'costume-king-v2', prompt: 'Low-poly voxel majestic crimson royal coat for a blocky game avatar, gold embroidery, white fur collar, jeweled gold buttons, no person, no head, no legs, no stand' },
  { name: 'costume-military-v2', prompt: 'Low-poly voxel detailed green military uniform for a blocky game avatar, tactical vest, shoulder straps, metal buckles and pockets, no person, no head, no legs, no stand' },
  { name: 'costume-knight-v2', prompt: 'Low-poly voxel detailed silver knight armor for a blocky game avatar, polished chest plates, gold rivets, shoulder guards, no person, no head, no legs, no stand' },
  { name: 'costume-explorer-v2', prompt: 'Low-poly voxel brown explorer jacket for a blocky game avatar, leather shoulder straps, travel pouches, brass buckles and rolled map, no person, no head, no legs, no stand' },
  { name: 'costume-princess-v2', prompt: 'Low-poly voxel elegant pink princess bodice for a blocky game avatar, gold edging, puff sleeves, decorative bows, no person, no head, no legs, no stand' },
  { name: 'wig-louis14-v2', prompt: 'Low-poly voxel magnificent Louis XIV wig, tall dark brown curls, many side ringlets and long back curls, no head, no face, no stand, game accessory' },
  { name: 'wig-louis15-v2', prompt: 'Low-poly voxel refined Louis XV wig, short powdered white curls and small tied ponytail, no head, no face, no stand, game accessory' },
  { name: 'cape-king', prompt: 'Low-poly voxel flowing crimson royal cape, gold border and white fur shoulder collar, dramatic cloth folds, isolated garment viewed from the back, no person, no head, no stand' },
  { name: 'cape-louis14', prompt: 'Low-poly voxel flowing navy blue royal cape, ornate gold border and small gold embroidery, dramatic cloth folds, isolated garment viewed from the back, no person, no head, no stand' },
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
  const output = `assets/models/${asset.name}.glb`;
  if (await Bun.file(output).exists()) {
    state[asset.name] = { ...state[asset.name], status: 'DONE' };
    console.log(`${asset.name}: déjà prêt`);
    return;
  }
  try {
    if (!state[asset.name]?.jobId) {
      const result = await client.request('SubmitHunyuanTo3DRapidJob', { Prompt: asset.prompt, ResultFormat: 'GLB', EnablePBR: false });
      state[asset.name] = { jobId: result.JobId, status: 'SUBMITTED' };
      await saveState();
      console.log(`${asset.name}: job ${result.JobId}`);
    }
  } catch (error) {
    state[asset.name] = { ...state[asset.name], status: 'FAIL', error: String(error) };
    await saveState();
    console.error(`${asset.name}: ${error}`);
  }
}

async function download(asset) {
  const output = `assets/models/${asset.name}.glb`;
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
    const raw = `.tmp/hunyuan-characters/${asset.name}-raw.glb`;
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

for (const asset of assets) {
  await submit(asset);
  await download(asset);
}
const failed = assets.filter((asset) => state[asset.name]?.status !== 'DONE');
console.log(`${assets.length - failed.length}/${assets.length} modèles prêts`);
if (failed.length > 0) process.exitCode = 1;
