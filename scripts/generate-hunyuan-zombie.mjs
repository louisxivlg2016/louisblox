import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) throw new Error('AI3D_SECRET_ID et AI3D_SECRET_KEY sont requis dans .env');
const client = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const statePath = '.tmp/hunyuan-zombie-job.json';
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
if (process.argv.includes('--retry')) delete state.jobId;
await mkdir('.tmp/hunyuan-zombie', { recursive: true });
await mkdir('assets/models', { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const raw = '.tmp/hunyuan-zombie/zombie-raw.glb';
const output = 'assets/models/zombie.glb';
if (!await Bun.file(output).exists()) {
  let jobId = state.jobId;
  if (!jobId) {
    const result = await client.request('SubmitHunyuanTo3DRapidJob', {
      Prompt: 'Minecraft voxel zombie, green square head, cyan shirt, blue pants, arms stretched forward, full body head to toe, blocky low-poly pixelated game asset, no background',
      ResultFormat: 'GLB',
      EnablePBR: false,
    });
    jobId = result.JobId;
    state.jobId = jobId;
    state.status = 'SUBMITTED';
    await Bun.write(statePath, JSON.stringify(state, null, 2));
  }
  let files;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await client.request('QueryHunyuanTo3DRapidJob', { JobId: jobId });
    if (result.Status === 'DONE') {
      files = result.ResultFile3Ds;
      break;
    }
    if (result.Status === 'FAIL') {
      state.status = 'FAIL';
      await Bun.write(statePath, JSON.stringify(state, null, 2));
      throw new Error(result.ErrorMessage || 'La génération du zombie a échoué');
    }
    console.log(`Zombie : ${result.Status}`);
    await sleep(5000);
  }
  if (!files) throw new Error('Délai de génération du zombie dépassé');
  const file = files.find((entry) => (entry.Type || '').toUpperCase() === 'GLB') || files[0];
  const response = await fetch(file.Url);
  if (!response.ok) throw new Error(`Téléchargement ${response.status}`);
  await Bun.write(raw, await response.arrayBuffer());
  const result = Bun.spawnSync({
    cmd: ['bunx', '@gltf-transform/cli', 'optimize', raw, output, '--texture-compress', 'webp', '--texture-size', '256', '--simplify-error', '0.005', '--no-compress'],
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (result.exitCode !== 0) throw new Error('Optimisation du zombie échouée');
}
state.status = 'DONE';
await Bun.write(statePath, JSON.stringify(state, null, 2));
console.log('Zombie Hunyuan prêt.');
