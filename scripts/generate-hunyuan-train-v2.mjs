import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) throw new Error('AI3D_SECRET_ID et AI3D_SECRET_KEY sont requis dans .env');
const client = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const statePath = '.tmp/hunyuan-train-v2-job.json';
const raw = '.tmp/hunyuan-train-v2.glb';
const output = 'assets/models/train.glb';
await mkdir('.tmp', { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const save = () => Bun.write(statePath, JSON.stringify(state, null, 2));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (!state.jobId) {
  for (let attempt = 0; attempt < 36; attempt += 1) {
    try {
      const result = await client.request('SubmitHunyuanTo3DRapidJob', {
        Prompt: 'Voxel metro train, white body, black front windshield, rectangular side windows and doors, four connected cars, accurate proportions, no background, no text',
        ResultFormat: 'GLB',
        EnablePBR: false,
      });
      state.jobId = result.JobId;
      state.status = 'SUBMITTED';
      await save();
      console.log(`Train v2: job ${result.JobId}`);
      break;
    } catch (error) {
      if (error.code !== 'RequestLimitExceeded.JobNumExceed' || attempt === 35) throw error;
      await sleep(10000);
    }
  }
}
if (!await Bun.file(raw).exists()) {
  let files;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const result = await client.request('QueryHunyuanTo3DRapidJob', { JobId: state.jobId });
    if (result.Status === 'DONE') { files = result.ResultFile3Ds; break; }
    if (result.Status === 'FAIL') throw new Error(result.ErrorMessage || 'Génération refusée');
    if (attempt % 6 === 0) console.log(`Train v2: ${result.Status}`);
    await sleep(5000);
  }
  if (!files) throw new Error('Délai de génération dépassé');
  const file = files.find((entry) => (entry.Type || '').toUpperCase() === 'GLB') || files[0];
  if (!file?.Url) throw new Error('Aucun fichier GLB dans le résultat');
  const response = await fetch(file.Url);
  if (!response.ok) throw new Error(`Téléchargement ${response.status}`);
  await Bun.write(raw, await response.arrayBuffer());
  state.status = 'DOWNLOADED';
  await save();
}
const optimized = Bun.spawnSync({
  cmd: ['bunx', '@gltf-transform/cli', 'optimize', raw, output, '--texture-compress', 'webp', '--texture-size', '512', '--simplify-error', '0.005', '--no-compress'],
  stdout: 'inherit',
  stderr: 'inherit',
});
if (optimized.exitCode !== 0) throw new Error('Optimisation du GLB échouée');
state.status = 'DONE';
await save();
console.log(`Train v2 prêt: ${output}`);
