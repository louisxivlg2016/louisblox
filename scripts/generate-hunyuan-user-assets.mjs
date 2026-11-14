import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) throw new Error('AI3D_SECRET_ID et AI3D_SECRET_KEY sont requis dans .env');
const client = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const assets = [
  {
    name: 'footballer',
    image: '.tmp/footboleur-reference.jpeg',
    raw: '.tmp/hunyuan-user-assets/footballer.glb',
    output: 'assets/models/full-footballer.glb',
  },
  {
    name: 'airplane',
    image: '.tmp/avion-reference.jpeg',
    raw: '.tmp/hunyuan-user-assets/airplane.glb',
    output: 'assets/models/airplane.glb',
  },
  {
    name: 'train',
    image: '.tmp/train-reference.jpeg',
    raw: '.tmp/hunyuan-user-assets/train.glb',
    output: 'assets/models/train.glb',
  },
];
const only = process.argv.indexOf('--only');
const requested = new Set(only >= 0 ? (process.argv[only + 1] ?? '').split(',') : assets.map((asset) => asset.name));
const statePath = '.tmp/hunyuan-user-assets.json';
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const save = () => Bun.write(statePath, JSON.stringify(state, null, 2));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await mkdir('.tmp/hunyuan-user-assets', { recursive: true });

for (const asset of assets) {
  if (!requested.has(asset.name) || state[asset.name]?.status === 'DONE' && await Bun.file(asset.output).exists()) continue;
  if (!state[asset.name]?.jobId) {
    for (let attempt = 0; attempt < 36; attempt += 1) {
      try {
        const result = await client.request('SubmitHunyuanTo3DRapidJob', {
          ImageBase64: Buffer.from(await Bun.file(asset.image).arrayBuffer()).toString('base64'),
          ResultFormat: 'GLB',
          EnablePBR: false,
        });
        state[asset.name] = { jobId: result.JobId, status: 'SUBMITTED' };
        await save();
        console.log(`${asset.name}: job ${result.JobId}`);
        break;
      } catch (error) {
        if (error.code !== 'RequestLimitExceeded.JobNumExceed' || attempt === 35) throw error;
        console.log(`${asset.name}: attente d’un emplacement de génération`);
        await sleep(10000);
      }
    }
  }
  if (!await Bun.file(asset.raw).exists()) {
    let files;
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const result = await client.request('QueryHunyuanTo3DRapidJob', { JobId: state[asset.name].jobId });
      if (result.Status === 'DONE') { files = result.ResultFile3Ds; break; }
      if (result.Status === 'FAIL') throw new Error(result.ErrorMessage || `${asset.name}: génération refusée`);
      if (attempt % 6 === 0) console.log(`${asset.name}: ${result.Status}`);
      await sleep(5000);
    }
    if (!files) throw new Error(`${asset.name}: délai de génération dépassé`);
    const file = files.find((entry) => (entry.Type || '').toUpperCase() === 'GLB') || files[0];
    if (!file?.Url) throw new Error(`${asset.name}: aucun fichier GLB`);
    const response = await fetch(file.Url);
    if (!response.ok) throw new Error(`${asset.name}: téléchargement ${response.status}`);
    await Bun.write(asset.raw, await response.arrayBuffer());
    state[asset.name].status = 'DOWNLOADED';
    await save();
  }
  const optimized = Bun.spawnSync({
    cmd: ['bunx', '@gltf-transform/cli', 'optimize', asset.raw, asset.output, '--texture-compress', 'webp', '--texture-size', '512', '--simplify-error', '0.005', '--no-compress'],
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (optimized.exitCode !== 0) throw new Error(`${asset.name}: optimisation échouée`);
  state[asset.name].status = 'DONE';
  await save();
  console.log(`${asset.name}: ${asset.output}`);
}
