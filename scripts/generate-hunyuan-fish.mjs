import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir, unlink } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) throw new Error('Identifiants AI3D manquants dans .env');
const hy = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const statePath = '.tmp/hunyuan-fish-jobs.json';
await mkdir('assets/models', { recursive: true });
await mkdir('.tmp', { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const fish = [
  ['fish-salmon', 'voxel style blocky salmon, full fish side view, red-orange body, small fins and tail, made of cubes, Minecraft pixel texture, plain background'],
  ['fish-clownfish', 'voxel style blocky clownfish, full fish side view, orange body with white stripes and black fins, made of cubes, pixel texture, plain background'],
  ['fish-blue-tang', 'voxel style blocky blue tang fish, full fish side view, bright blue body, dark markings and yellow tail, made of cubes, pixel texture, plain background'],
];

for (const [name, prompt] of fish) {
  const raw = `assets/models/${name}-raw.glb`;
  const output = `assets/models/${name}.glb`;
  if (await Bun.file(output).exists()) {
    console.log(`${name}: déjà optimisé`);
    continue;
  }
  if (state[name]?.status !== 'DONE') {
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
    await Bun.write(raw, await response.arrayBuffer());
  }
  const result = Bun.spawnSync({
    cmd: ['bunx', '@gltf-transform/cli', 'optimize', raw, output, '--texture-compress', 'webp', '--texture-size', '256', '--simplify-error', '0.006', '--no-compress'],
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (result.exitCode !== 0) throw new Error(`${name}: optimisation échouée`);
  await unlink(raw);
  state[name] = { ...state[name], status: 'DONE' };
  await Bun.write(statePath, JSON.stringify(state, null, 2));
  console.log(`${name}: GLB prêt`);
}
