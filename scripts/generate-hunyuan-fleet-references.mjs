import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) throw new Error('AI3D_SECRET_ID et AI3D_SECRET_KEY sont requis dans .env');
const client = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const directory = '.tmp/hunyuan-fleet-v2';
const statePath = '.tmp/hunyuan-fleet-v2-jobs.json';
await mkdir(directory, { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const assets = [
  ['blueCar', 'Gemini_Generated_Image_3yzxre3yzxre3yzx.jpeg'],
  ['raceCar', 'Gemini_Generated_Image_8d9wtd8d9wtd8d9w.jpeg'],
  ['jeep', 'Gemini_Generated_Image_242elb242elb242e.jpeg'],
  ['carriage', 'Gemini_Generated_Image_myh79kmyh79kmyh7.jpeg'],
  ['cannon', 'Gemini_Generated_Image_ggtk6uggtk6uggtk.jpeg'],
];
const only = process.argv.indexOf('--only');
const requested = new Set((only >= 0 ? process.argv[only + 1] ?? '' : '').split(',').filter(Boolean));
if (process.argv.includes('--retry')) {
  for (const [name] of assets) if (state[name]?.status === 'FAIL') delete state[name];
}
const save = () => Bun.write(statePath, JSON.stringify(state, null, 2));
let failed = false;

for (const [name, filename] of assets) {
  if (requested.size > 0 && !requested.has(name)) continue;
  const source = `/home/louisxiv/Downloads/${filename}`;
  const output = `${directory}/${name}.glb`;
  if (state[name]?.status === 'DONE' && await Bun.file(output).exists()) {
    console.log(`${name}: déjà prêt`);
    continue;
  }
  try {
    if (state[name]?.status === 'DOWNLOADED' && await Bun.file(`${directory}/${name}-raw.glb`).exists()) {
      console.log(`${name}: source déjà téléchargée`);
    } else {
      if (!state[name]?.jobId) {
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
            console.log(`${name}: attente d’un emplacement de génération`);
            await sleep(10000);
          }
        }
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
      await Bun.write(`${directory}/${name}-raw.glb`, await response.arrayBuffer());
      state[name].status = 'DOWNLOADED';
      await save();
    }
    const optimized = Bun.spawnSync({
      cmd: ['bunx', '@gltf-transform/cli', 'optimize', `${directory}/${name}-raw.glb`, output, '--texture-compress', 'webp', '--texture-size', '256', '--simplify-error', '0.005', '--no-compress'],
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
  }
}
if (failed) process.exitCode = 1;
