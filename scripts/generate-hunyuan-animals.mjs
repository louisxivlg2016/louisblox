import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) throw new Error('Identifiants AI3D manquants dans .env');
const hy = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const statePath = '.tmp/hunyuan-animal-jobs.json';
await mkdir('assets/models', { recursive: true });
await mkdir('.tmp', { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const animals = [
  ['camel', 'voxel style blocky low-poly camel, two humps, long neck, made of cubes, Minecraft pixel texture, full body, side view, plain background'],
  ['cow', 'voxel style blocky low-poly cow, brown and white patches, small horns, made of cubes, Minecraft pixel texture, full body, side view, plain background'],
  ['horse', 'voxel style blocky low-poly horse, brown body, dark mane and tail, long neck, made of cubes, Minecraft pixel texture, full body, side view, plain background'],
  ['pig', 'voxel style blocky low-poly pink pig, square snout, small legs, made of cubes, Minecraft pixel texture, full body, side view, plain background'],
  ['sheep', 'voxel style blocky low-poly sheep, white wool cubes, dark face and legs, Minecraft pixel texture, full body, side view, plain background'],
  ['chicken', 'voxel style blocky low-poly chicken, white feather cubes, red comb and red wing feathers, orange beak, full body, plain background'],
  ['duck', 'voxel style blocky low-poly duck, white body cubes, dark green head, orange beak, Minecraft pixel texture, full body, plain background'],
  ['bear', 'voxel style blocky low-poly brown bear, large body, small round ears, made of cubes, Minecraft pixel texture, full body, side view, plain background'],
  ['deer', 'voxel style blocky low-poly deer, brown body, slender legs, branched antlers, made of cubes, Minecraft pixel texture, full body, plain background'],
  ['wolf', 'voxel style blocky low-poly gray wolf, pointed ears, long muzzle and tail, made of cubes, Minecraft pixel texture, full body, side view, plain background'],
  ['snowWolf', 'voxel style blocky low-poly white arctic wolf, pointed ears, long muzzle and tail, made of cubes, Minecraft pixel texture, full body, plain background'],
  ['snowBear', 'voxel style blocky low-poly polar bear, large white body, small round ears, made of cubes, Minecraft pixel texture, full body, plain background'],
];

for (const [name, prompt] of animals) {
  const output = `assets/models/${name}-raw.glb`;
  if (state[name]?.status === 'DONE' && await Bun.file(output).exists()) {
    console.log(`${name}: déjà téléchargé`);
    continue;
  }
  let jobId = state[name]?.jobId;
  if (!jobId) {
    const submitted = await hy.request('SubmitHunyuanTo3DRapidJob', { Prompt: prompt, ResultFormat: 'GLB', EnablePBR: false });
    jobId = submitted.JobId;
    state[name] = { jobId, status: 'SUBMITTED' };
    await Bun.write(statePath, JSON.stringify(state, null, 2));
    console.log(`${name}: job ${jobId}`);
  }
  let files;
  for (;;) {
    const result = await hy.request('QueryHunyuanTo3DRapidJob', { JobId: jobId });
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
  const file = files.find((entry) => (entry.Type || '').toUpperCase() === 'GLB') || files[0];
  const response = await fetch(file.Url);
  if (!response.ok) throw new Error(`${name}: téléchargement ${response.status}`);
  await Bun.write(output, await response.arrayBuffer());
  state[name].status = 'DONE';
  await Bun.write(statePath, JSON.stringify(state, null, 2));
  console.log(`${name}: GLB téléchargé`);
}
