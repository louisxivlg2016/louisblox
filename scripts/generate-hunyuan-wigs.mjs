import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) throw new Error('AI3D_SECRET_ID et AI3D_SECRET_KEY sont requis dans .env');
const client = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const directory = '.tmp/hunyuan-wigs';
const statePath = `${directory}/jobs.json`;
await mkdir(directory, { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const assets = [
  { name: 'louis14', source: 'son/peruque-louis-xiv.jpeg', output: 'assets/models/wig-louis14-v2.glb' },
  { name: 'louis15', source: 'son/perruque-louis-xv.jpeg', output: 'assets/models/wig-louis15-v2.glb' },
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const save = () => Bun.write(statePath, JSON.stringify(state, null, 2));

for (const asset of assets) {
  const current = state[asset.name] ?? {};
  const raw = `${directory}/${asset.name}-raw.glb`;
  if (!current.jobId) {
    for (let attempt = 0; attempt < 36; attempt += 1) {
      try {
        const result = await client.request('SubmitHunyuanTo3DRapidJob', {
          ImageBase64: Buffer.from(await Bun.file(asset.source).arrayBuffer()).toString('base64'),
          ResultFormat: 'GLB',
          EnablePBR: false,
        });
        current.jobId = result.JobId;
        current.status = 'SUBMITTED';
        state[asset.name] = current;
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
  if (!await Bun.file(raw).exists()) {
    let files;
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const result = await client.request('QueryHunyuanTo3DRapidJob', { JobId: current.jobId });
      if (result.Status === 'DONE') { files = result.ResultFile3Ds; break; }
      if (result.Status === 'FAIL') throw new Error(result.ErrorMessage || 'Génération refusée');
      if (attempt % 6 === 0) console.log(`${asset.name}: ${result.Status}`);
      await sleep(5000);
    }
    if (!files) throw new Error(`${asset.name}: délai dépassé`);
    const file = files.find((entry) => (entry.Type || '').toUpperCase() === 'GLB') || files[0];
    if (!file?.Url) throw new Error(`${asset.name}: aucun GLB`);
    const response = await fetch(file.Url);
    if (!response.ok) throw new Error(`${asset.name}: téléchargement ${response.status}`);
    await Bun.write(raw, await response.arrayBuffer());
    current.status = 'DOWNLOADED';
    await save();
  }
  const optimized = Bun.spawnSync({
    cmd: ['bunx', '@gltf-transform/cli', 'optimize', raw, asset.output, '--texture-compress', 'webp', '--texture-size', '512', '--simplify-error', '0.005', '--no-compress'],
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (optimized.exitCode !== 0) throw new Error(`${asset.name}: optimisation échouée`);
  current.status = 'DONE';
  await save();
  console.log(`${asset.name}: perruque prête depuis ${asset.source}`);
}
