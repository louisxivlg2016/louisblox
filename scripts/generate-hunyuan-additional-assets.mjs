import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) throw new Error('AI3D_SECRET_ID et AI3D_SECRET_KEY sont requis dans .env');
const client = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const statePath = '.tmp/hunyuan-new-assets-jobs.json';
const directory = '.tmp/hunyuan-new-assets';
await mkdir(directory, { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const assets = [
  { name: 'firefighter', image: 'Gemini_Generated_Image_gu5grngu5grngu5g.jpeg' },
  { name: 'blue-car', image: 'Gemini_Generated_Image_3yzxre3yzxre3yzx.jpeg' },
  { name: 'race-car', image: 'Gemini_Generated_Image_8d9wtd8d9wtd8d9w.jpeg' },
  { name: 'carriage', image: 'Gemini_Generated_Image_myh79kmyh79kmyh7.jpeg' },
  { name: 'jeep', image: 'Gemini_Generated_Image_242elb242elb242e.jpeg' },
  { name: 'police-car', image: 'Gemini_Generated_Image_4op9l84op9l84op9.jpeg' },
  { name: 'fire-truck', image: 'Gemini_Generated_Image_1v8gvg1v8gvg1v8g.jpeg' },
  { name: 'cannon', image: 'Gemini_Generated_Image_ggtk6uggtk6uggtk.jpeg' },
  { name: 'soldier', image: 'Gemini_Generated_Image_4lgxug4lgxug4lgx.jpeg' },
  { name: 'rifle', image: 'Gemini_Generated_Image_w5gqnrw5gqnrw5gq.jpeg' },
];
const selected = process.argv.indexOf('--only');
const requested = selected >= 0 ? process.argv[selected + 1] : null;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const saveState = () => Bun.write(statePath, JSON.stringify(state, null, 2));

async function optimize(asset) {
  const raw = `${directory}/${asset.name}-raw.glb`;
  const output = `${directory}/${asset.name}.glb`;
  const result = Bun.spawnSync({
    cmd: ['bunx', '@gltf-transform/cli', 'optimize', raw, output, '--texture-compress', 'webp', '--texture-size', '256', '--simplify-error', '0.005', '--no-compress'],
    stdout: 'inherit', stderr: 'inherit',
  });
  if (result.exitCode !== 0) throw new Error(`${asset.name}: optimisation du GLB échouée`);
  state[asset.name].status = 'DONE';
  await saveState();
  console.log(`${asset.name}: modèle Hunyuan optimisé`);
}

for (const asset of assets) {
  if (requested && asset.name !== requested) continue;
  const source = `/home/louisxiv/Downloads/${asset.image}`;
  if (!await Bun.file(source).exists()) throw new Error(`Image de référence absente : ${source}`);
  if (state[asset.name]?.status === 'DONE' && await Bun.file(`${directory}/${asset.name}.glb`).exists()) {
    console.log(`${asset.name}: déjà prêt`);
    continue;
  }
  try {
    if (state[asset.name]?.status === 'DOWNLOADED' && await Bun.file(`${directory}/${asset.name}-raw.glb`).exists()) {
      await optimize(asset);
      continue;
    }
    if (!state[asset.name]?.jobId) {
      let submitted;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        try {
          submitted = await client.request('SubmitHunyuanTo3DRapidJob', {
            ImageBase64: Buffer.from(await Bun.file(source).arrayBuffer()).toString('base64'),
            ResultFormat: 'GLB',
            EnablePBR: false,
          });
          break;
        } catch (error) {
          if (error.code !== 'RequestLimitExceeded.JobNumExceed' || attempt === 29) throw error;
          console.log(`${asset.name}: attente d’un emplacement de génération`);
          await sleep(10000);
        }
      }
      state[asset.name] = { jobId: submitted.JobId, status: 'SUBMITTED', image: source };
      await saveState();
      console.log(`${asset.name}: job ${submitted.JobId}`);
    }
    let files;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const result = await client.request('QueryHunyuanTo3DRapidJob', { JobId: state[asset.name].jobId });
      if (result.Status === 'DONE') { files = result.ResultFile3Ds; break; }
      if (result.Status === 'FAIL') throw new Error(result.ErrorMessage || 'La génération Hunyuan a échoué');
      if (attempt % 6 === 0) console.log(`${asset.name}: ${result.Status}`);
      await sleep(5000);
    }
    if (!files) throw new Error(`${asset.name}: délai de génération dépassé`);
    const file = files.find((entry) => (entry.Type || '').toUpperCase() === 'GLB') || files[0];
    if (!file?.Url) throw new Error(`${asset.name}: aucun GLB dans le résultat`);
    const response = await fetch(file.Url);
    if (!response.ok) throw new Error(`${asset.name}: téléchargement ${response.status}`);
    await Bun.write(`${directory}/${asset.name}-raw.glb`, await response.arrayBuffer());
    state[asset.name].status = 'DOWNLOADED';
    await saveState();
    await optimize(asset);
  } catch (error) {
    state[asset.name] = { ...state[asset.name], status: 'FAIL', error: String(error) };
    await saveState();
    console.error(`${asset.name}: ${error}`);
  }
}
let missing = 0;
for (const asset of assets) {
  if (requested && asset.name !== requested) continue;
  if (state[asset.name]?.status !== 'DONE' || !await Bun.file(`${directory}/${asset.name}.glb`).exists()) missing += 1;
}
console.log(`${missing === 0 ? 'Modèles demandés prêts' : `${missing} modèle(s) non terminé(s)`}`);
if (missing > 0) process.exitCode = 1;
