import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) throw new Error('AI3D_SECRET_ID et AI3D_SECRET_KEY sont requis dans .env');
const client = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const directory = '.tmp/hunyuan-living';
const statePath = '.tmp/hunyuan-living-jobs.json';
await mkdir(directory, { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const assets = [
  ['cow', 'vache.jpeg'],
  ['chicken', 'poule.jpeg'],
  ['sheep', 'mouton.jpeg'],
  ['pig', 'cochon.jpeg'],
  ['horse', 'cheval.jpeg'],
  ['camel', 'chameau.jpeg'],
  ['duck', 'canard.jpeg'],
  ['trader', 'marchand.jpeg'],
  ['classic-girl', 'fille.jpeg'],
  ['classic-boy', 'perssonage-garcon.jpeg'],
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const save = () => Bun.write(statePath, JSON.stringify(state, null, 2));

const only = process.argv.indexOf('--only');
const requested = new Set((only >= 0 ? process.argv[only + 1] ?? '' : '').split(',').filter(Boolean));
let failed = false;

for (const [name, filename] of assets) {
  if (requested.size > 0 && !requested.has(name)) continue;
  const source = `/home/louisxiv/louisblox/son/${filename}`;
  if (!await Bun.file(source).exists()) throw new Error(`Image absente : ${source}`);
  if (state[name]?.status === 'DONE' && await Bun.file(`${directory}/${name}.glb`).exists()) continue;
  try {
    if (!state[name]?.jobId) {
      const submitted = await client.request('SubmitHunyuanTo3DRapidJob', {
        ImageBase64: Buffer.from(await Bun.file(source).arrayBuffer()).toString('base64'),
        ResultFormat: 'GLB',
        EnablePBR: false,
      });
      state[name] = { jobId: submitted.JobId, status: 'SUBMITTED', image: source };
      await save();
      console.log(`${name}: job ${submitted.JobId}`);
    }
    let files;
    for (let attempt = 0; attempt < 120; attempt += 1) {
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
    const raw = `${directory}/${name}-raw.glb`;
    await Bun.write(raw, await response.arrayBuffer());
    const output = `${directory}/${name}.glb`;
    const optimized = Bun.spawnSync({ cmd: ['bunx', '@gltf-transform/cli', 'optimize', raw, output, '--texture-compress', 'webp', '--texture-size', '256', '--simplify-error', '0.005', '--no-compress'], stdout: 'inherit', stderr: 'inherit' });
    if (optimized.exitCode !== 0) throw new Error(`${name}: optimisation échouée`);
    state[name].status = 'DONE';
    await save();
    console.log(`${name}: modèle Hunyuan prêt`);
  } catch (error) {
    failed = true;
    state[name] = { ...state[name], status: 'FAIL', error: String(error) };
    await save();
    console.error(`${name}: ${error}`);
    if (String(error).includes('Resources are insufficient')) {
      console.error('Quota Hunyuan insuffisant : arrêt de la file sans générer de faux modèles.');
      break;
    }
  }
}
if (failed) process.exitCode = 1;
