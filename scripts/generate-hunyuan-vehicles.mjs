import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir, unlink } from 'node:fs/promises';

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
const statePath = '.tmp/hunyuan-vehicle-jobs.json';
await mkdir('assets/models', { recursive: true });
await mkdir('.tmp', { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const assets = [
  {
    name: 'raceCar',
    prompt: 'Minecraft voxel red open-top Formula racing car, blocky cuboid body, no roof, exposed driver seat and visible square steering wheel, four chunky black wheels, low-poly pixelated game asset, full vehicle, no background',
  },
  {
    name: 'blueCar',
    prompt: 'Minecraft voxel blue passenger car with an open visible cabin interior, transparent square windows and windshield, square steering wheel and two seats, four chunky black wheels, low-poly pixelated game asset, full vehicle, no background',
  },
  {
    name: 'airplane',
    prompt: 'Minecraft voxel passenger airplane, blocky cuboid fuselage and wings, visible cockpit with square steering controls, square passenger windows and visible seats inside, low-poly pixelated game asset, full aircraft, no background',
  },
  {
    name: 'train',
    prompt: 'Minecraft voxel passenger train, blocky locomotive and one passenger carriage, visible driver cabin, square windows with visible passenger seats inside, chunky wheels, low-poly pixelated game asset, full train, no background',
  },
];

async function generate(asset) {
  const raw = `assets/models/${asset.name}-raw.glb`;
  const output = `assets/models/${asset.name}.glb`;
  if (state[asset.name]?.status === 'DONE' && (await Bun.file(raw).exists() || await Bun.file(output).exists())) {
    console.log(`${asset.name}: déjà téléchargé`);
  } else {
    let jobId = state[asset.name]?.jobId;
    if (!jobId) {
      const submitted = await client.request('SubmitHunyuanTo3DRapidJob', {
        Prompt: asset.prompt,
        ResultFormat: 'GLB',
        EnablePBR: false,
      });
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
    console.log(`${asset.name}: GLB téléchargé`);
  }

  if (await Bun.file(output).exists()) return;
  const result = Bun.spawnSync({
    cmd: ['bunx', '@gltf-transform/cli', 'optimize', raw, output, '--texture-compress', 'webp', '--texture-size', '256', '--simplify-error', '0.003', '--no-compress'],
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (result.exitCode !== 0) throw new Error(`${asset.name}: optimisation échouée`);
  await unlink(raw);
  console.log(`${asset.name}: optimisé`);
}

for (const asset of [...assets].sort((a, b) => Number(Boolean(state[b.name]?.jobId)) - Number(Boolean(state[a.name]?.jobId)))) {
  await generate(asset);
}
console.log('Les quatre modèles de véhicules sont prêts.');
