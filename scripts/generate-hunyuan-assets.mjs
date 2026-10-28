import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) {
  throw new Error('AI3D_SECRET_ID et AI3D_SECRET_KEY sont requis dans .env');
}

const hy = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const statePath = '.tmp/hunyuan-jobs.json';
await mkdir('assets/models', { recursive: true });
await mkdir('.tmp', { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const assets = [
  {
    name: 'tnt',
    prompt: 'Minecraft voxel TNT bomb, red cube, white TNT letters, short black fuse, low-poly pixelated game asset, full object centered, no background',
  },
  {
    name: 'candle',
    prompt: 'Minecraft voxel candle, cream wax square pillar, black wick, small orange pixel flame, low-poly pixelated game asset, full object centered, no background',
  },
];

for (const asset of assets) {
  const output = `assets/models/${asset.name}-raw.glb`;
  if (state[asset.name]?.status === 'DONE' && await Bun.file(output).exists()) {
    console.log(`${asset.name}: déjà téléchargé`);
    continue;
  }

  let jobId = state[asset.name]?.jobId;
  if (!jobId) {
    const submitted = await hy.request('SubmitHunyuanTo3DRapidJob', {
      Prompt: asset.prompt,
      ResultFormat: 'GLB',
      EnablePBR: true,
    });
    jobId = submitted.JobId;
    state[asset.name] = { jobId, status: 'SUBMITTED' };
    await Bun.write(statePath, JSON.stringify(state, null, 2));
    console.log(`${asset.name}: job ${jobId}`);
  }

  let files;
  for (;;) {
    const result = await hy.request('QueryHunyuanTo3DRapidJob', { JobId: jobId });
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

  const file = files.find((entry) => (entry.Type || '').toUpperCase() === 'GLB') || files[0];
  const response = await fetch(file.Url);
  if (!response.ok) throw new Error(`${asset.name}: téléchargement ${response.status}`);
  await Bun.write(output, await response.arrayBuffer());
  state[asset.name].status = 'DONE';
  await Bun.write(statePath, JSON.stringify(state, null, 2));
  console.log(`${asset.name}: GLB téléchargé`);
}
