import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) throw new Error('AI3D_SECRET_ID et AI3D_SECRET_KEY sont requis dans .env');
const client = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const rapid = process.argv.includes('--rapid');
const lowPoly = process.argv.includes('--low-poly');
const directory = rapid ? '.tmp/hunyuan-living-guided' : lowPoly ? '.tmp/hunyuan-living-low-poly' : '.tmp/hunyuan-living-pro';
const statePath = rapid ? '.tmp/hunyuan-living-guided-jobs.json' : lowPoly ? '.tmp/hunyuan-living-low-poly-jobs.json' : '.tmp/hunyuan-living-pro-jobs.json';
await mkdir(directory, { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const assets = [
  ['cow', 'vache.jpeg', 'Voxel cow from reference, brown and white patches, one head at front, four block legs, small tail at rear. No second head, rear face, extra limbs or spikes.'],
  ['chicken', 'poule.jpeg', 'Voxel chicken from reference, white body, red comb, yellow beak, two thin legs and wings. One head only, no extra face or limbs.'],
  ['sheep', 'mouton.jpeg', 'Voxel sheep from reference, white wool, beige face, one head at front, four block legs, short tail. No extra head or face.'],
  ['pig', 'cochon.jpeg', 'Voxel pig from reference, pink body, one head at front, snout, four block legs, small curly tail. No extra head or face.'],
  ['camel', 'chameau.jpeg', 'Voxel camel from reference, tan body, one hump, long neck, one head at front, four legs, short tail. No extra head or face.'],
  ['duck', 'canard.jpeg', 'Voxel duck from reference, green head, yellow beak, gray brown body, two thin legs and wings. One head only, no extra face.'],
  ['trader', 'marchand.jpeg', 'Voxel trader from reference, blue hood and robe, gold trim, green eyes, large nose, brown boots. One head with one front face, no rear face.'],
  ['classic-girl', 'fille.jpeg', 'Voxel girl from reference, orange hair on top and long at back, green eyes on front only, purple jacket, dark trousers. One head and one face.'],
  ['classic-boy', 'perssonage-garcon.jpeg', 'Voxel boy from reference, blond hair on top, green eyes on front only, green jacket, red scarf, dark trousers. One head and one face.'],
];
const only = process.argv.indexOf('--only');
const requested = new Set((only >= 0 ? process.argv[only + 1] ?? '' : '').split(',').filter(Boolean));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const save = () => Bun.write(statePath, JSON.stringify(state, null, 2));
let failed = false;

for (const [name, filename, prompt] of assets) {
  if (requested.size > 0 && !requested.has(name)) continue;
  if (prompt.length > 200) throw new Error(`${name}: prompt trop long`);
  const source = `/home/louisxiv/louisblox/son/${filename}`;
  if (state[name]?.status === 'DONE' && await Bun.file(`${directory}/${name}.glb`).exists()) continue;
  try {
    if (!state[name]?.jobId) {
      let submitted;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        try {
          submitted = await client.request(rapid ? 'SubmitHunyuanTo3DRapidJob' : 'SubmitHunyuanTo3DProJob', rapid ? {
            ImageBase64: Buffer.from(await Bun.file(source).arrayBuffer()).toString('base64'),
            Prompt: prompt,
            ResultFormat: 'GLB',
            EnablePBR: false,
          } : {
            Model: '3.0',
            GenerateType: lowPoly ? 'LowPoly' : 'Sketch',
            ImageBase64: Buffer.from(await Bun.file(source).arrayBuffer()).toString('base64'),
            ...(lowPoly ? {} : { Prompt: prompt }),
            FaceCount: 8000,
            EnablePBR: false,
          });
          break;
        } catch (error) {
          if (error.code !== 'RequestLimitExceeded.JobNumExceed' || attempt === 59) throw error;
          console.log(`${name}: attente d’un emplacement de génération`);
          await sleep(10000);
        }
      }
      state[name] = { jobId: submitted.JobId, status: 'SUBMITTED', image: source, prompt };
      await save();
      console.log(`${name}: job ${rapid ? 'Rapid guidé' : 'Pro'} ${submitted.JobId}`);
    }
    let files;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const result = await client.request(rapid ? 'QueryHunyuanTo3DRapidJob' : 'QueryHunyuanTo3DProJob', { JobId: state[name].jobId });
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
    console.log(`${name}: modèle Pro prêt`);
  } catch (error) {
    failed = true;
    state[name] = { ...state[name], status: 'FAIL', error: String(error) };
    await save();
    console.error(`${name}: ${error}`);
    if (String(error).includes('Resources are insufficient')) break;
  }
}
if (failed) process.exitCode = 1;
