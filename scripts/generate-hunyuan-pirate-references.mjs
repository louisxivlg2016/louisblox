import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) throw new Error('AI3D_SECRET_ID et AI3D_SECRET_KEY sont requis dans .env');
const client = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const directory = '.tmp/hunyuan-pirate';
const statePath = '.tmp/hunyuan-pirate-jobs.json';
await mkdir(directory, { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const assets = [
  ['horse-saddle', 'selle.jpeg'],
  ['pirate-ship', 'bateau-pirate.jpeg'],
  ['pirate-treasure', 'tresore.jpeg'],
  ['pirate-player', 'pirate.jpeg'],
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const save = () => Bun.write(statePath, JSON.stringify(state, null, 2));
const only = process.argv.indexOf('--only');
const requested = new Set((only >= 0 ? process.argv[only + 1] ?? '' : '').split(',').filter(Boolean));
let failed = false;

for (const [name, filename] of assets) {
  if (requested.size > 0 && !requested.has(name)) continue;
  const source = `/home/louisxiv/louisblox/image/${filename}`;
  if (!await Bun.file(source).exists()) throw new Error(`Image absente : ${source}`);
  const output = `${directory}/${name}.glb`;
  const raw = `${directory}/${name}-raw.glb`;
  if (process.argv.includes('--retry') && state[name]?.status === 'FAIL') {
    if (await Bun.file(raw).exists()) state[name].status = 'DOWNLOADED';
    else delete state[name];
  }
  if (state[name]?.status === 'DONE' && await Bun.file(output).exists()) {
    console.log(`${name}: déjà prêt`);
    continue;
  }
  try {
    if (state[name]?.status === 'DOWNLOADED' && await Bun.file(raw).exists()) {
      console.log(`${name}: source déjà téléchargée`);
    } else {
      if (!state[name]?.jobId) {
        let submitted;
        for (let attempt = 0; attempt < 36; attempt += 1) {
          try {
            submitted = await client.request('SubmitHunyuanTo3DRapidJob', {
              ImageBase64: Buffer.from(await Bun.file(source).arrayBuffer()).toString('base64'),
              ResultFormat: 'GLB',
              EnablePBR: false,
            });
            break;
          } catch (error) {
            if (error.code !== 'RequestLimitExceeded.JobNumExceed' || attempt === 35) throw error;
            console.log(`${name}: attente d’un emplacement de génération`);
            await sleep(10000);
          }
        }
        state[name] = { jobId: submitted.JobId, status: 'SUBMITTED', image: source };
        await save();
        console.log(`${name}: job ${submitted.JobId}`);
      }
      let files;
      for (let attempt = 0; attempt < 180; attempt += 1) {
        const result = await client.request('QueryHunyuanTo3DRapidJob', { JobId: state[name].jobId });
        if (result.Status === 'DONE') { files = result.ResultFile3Ds; break; }
        if (result.Status === 'FAIL') throw new Error(result.ErrorMessage || 'Génération refusée');
        if (attempt % 6 === 0) console.log(`${name}: ${result.Status}`);
        await sleep(5000);
      }
      if (!files) throw new Error(`${name}: délai dépassé`);
      const file = files.find((entry) => (entry.Type || '').toUpperCase() === 'GLB') || files[0];
      if (!file?.Url) throw new Error(`${name}: aucun GLB`);
      const response = await fetch(file.Url);
      if (!response.ok) throw new Error(`${name}: téléchargement ${response.status}`);
      await Bun.write(raw, await response.arrayBuffer());
      state[name].status = 'DOWNLOADED';
      await save();
    }
    const optimized = Bun.spawnSync({
      cmd: ['bunx', '@gltf-transform/cli', 'optimize', raw, output, '--texture-compress', 'webp', '--texture-size', '256', '--simplify-error', '0.005', '--no-compress'],
      stdout: 'inherit',
      stderr: 'inherit',
    });
    if (optimized.exitCode !== 0) throw new Error(`${name}: optimisation échouée`);
    state[name].status = 'DONE';
    await save();
    console.log(`${name}: modèle Hunyuan prêt depuis ${source}`);
  } catch (error) {
    failed = true;
    state[name] = { ...state[name], status: 'FAIL', error: String(error) };
    await save();
    console.error(`${name}: ${error}`);
    if (String(error).includes('Resources are insufficient')) {
      console.error('Quota Hunyuan insuffisant : arrêt sans modèles de substitution.');
      break;
    }
  }
}
if (failed) process.exitCode = 1;
