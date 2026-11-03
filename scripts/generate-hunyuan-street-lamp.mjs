import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir, unlink } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) throw new Error('AI3D_SECRET_ID et AI3D_SECRET_KEY sont requis dans .env');
const client = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const statePath = '.tmp/hunyuan-street-lamp-jobs.json';
await mkdir('assets/models', { recursive: true });
await mkdir('.tmp', { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const name = 'parisStreetLamp';
const raw = 'assets/models/paris-street-lamp-raw.glb';
const output = 'assets/models/paris-street-lamp.glb';
if (state[name]?.status === 'DONE' && await Bun.file(output).exists()) {
  console.log('Lampadaire parisien déjà généré.');
} else {
  let jobId = state[name]?.jobId;
  if (!jobId) {
    const submitted = await client.request('SubmitHunyuanTo3DRapidJob', {
      Prompt: 'Minecraft voxel ornate Parisian street lamp, tall dark green cast iron post, decorative square base, curved lantern crown, transparent warm glowing glass lantern, low-poly pixelated game asset, full vertical object centered, no background',
      ResultFormat: 'GLB',
      EnablePBR: false,
    });
    jobId = submitted.JobId;
    state[name] = { jobId, status: 'SUBMITTED' };
    await Bun.write(statePath, JSON.stringify(state, null, 2));
    console.log(`Lampadaire parisien : job ${jobId}`);
  }
  let files;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await client.request('QueryHunyuanTo3DRapidJob', { JobId: jobId });
    if (result.Status === 'DONE') {
      files = result.ResultFile3Ds;
      break;
    }
    if (result.Status === 'FAIL') {
      state[name].status = 'FAIL';
      await Bun.write(statePath, JSON.stringify(state, null, 2));
      throw new Error(`Lampadaire parisien : ${result.ErrorMessage}`);
    }
    console.log(`Lampadaire parisien : ${result.Status}`);
    await sleep(5000);
  }
  if (!files) throw new Error('Lampadaire parisien : délai de génération dépassé');
  const file = files.find((entry) => (entry.Type || '').toUpperCase() === 'GLB') || files[0];
  const response = await fetch(file.Url);
  if (!response.ok) throw new Error(`Lampadaire parisien : téléchargement ${response.status}`);
  await Bun.write(raw, await response.arrayBuffer());
  state[name].status = 'DONE';
  await Bun.write(statePath, JSON.stringify(state, null, 2));
  console.log('Lampadaire parisien : GLB téléchargé');
}
if (!await Bun.file(output).exists()) {
  const result = Bun.spawnSync({
    cmd: ['bunx', '@gltf-transform/cli', 'optimize', raw, output, '--texture-compress', 'webp', '--texture-size', '256', '--simplify-error', '0.003', '--no-compress'],
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (result.exitCode !== 0) throw new Error('Lampadaire parisien : optimisation échouée');
  await unlink(raw);
  console.log('Lampadaire parisien : modèle optimisé');
}
