import common from 'tencentcloud-sdk-nodejs-common';
import { mkdir } from 'node:fs/promises';

const { CommonClient } = common;
if (!process.env.AI3D_SECRET_ID || !process.env.AI3D_SECRET_KEY) throw new Error('AI3D_SECRET_ID et AI3D_SECRET_KEY sont requis dans .env');
const client = new CommonClient('hunyuan.intl.tencentcloudapi.com', '2023-09-01', {
  credential: { secretId: process.env.AI3D_SECRET_ID, secretKey: process.env.AI3D_SECRET_KEY },
  region: 'ap-singapore',
  profile: { httpProfile: { endpoint: 'hunyuan.intl.tencentcloudapi.com', reqTimeout: 60 } },
});
const directory = '.tmp/hunyuan-extinguisher';
const statePath = '.tmp/hunyuan-extinguisher-job.json';
await mkdir(directory, { recursive: true });
const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const save = () => Bun.write(statePath, JSON.stringify(state, null, 2));
try {
  if (state.status !== 'DONE') {
    if (!state.jobId) {
      let submitted;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        try {
          submitted = await client.request('SubmitHunyuanTo3DProJob', {
            Model: '3.0',
            GenerateType: 'LowPoly',
            ImageBase64: Buffer.from(await Bun.file('son/extincteur.png').arrayBuffer()).toString('base64'),
            FaceCount: 4000,
            EnablePBR: false,
          });
          break;
        } catch (error) {
          if (error.code !== 'RequestLimitExceeded.JobNumExceed' || attempt === 29) throw error;
          console.log('Extincteur: attente d’un emplacement de génération');
          await sleep(10000);
        }
      }
      state.jobId = submitted.JobId;
      state.status = 'SUBMITTED';
      await save();
      console.log(`Extincteur: job ${submitted.JobId}`);
    }
    let files;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const result = await client.request('QueryHunyuanTo3DProJob', { JobId: state.jobId });
      if (result.Status === 'DONE') { files = result.ResultFile3Ds; break; }
      if (result.Status === 'FAIL') throw new Error(result.ErrorMessage || 'La génération Hunyuan a échoué');
      if (attempt % 6 === 0) console.log(`Extincteur: ${result.Status}`);
      await sleep(5000);
    }
    if (!files) throw new Error('Délai de génération dépassé');
    const file = files.find((entry) => (entry.Type || '').toUpperCase() === 'GLB') || files[0];
    if (!file?.Url) throw new Error('Aucun fichier GLB dans le résultat');
    const response = await fetch(file.Url);
    if (!response.ok) throw new Error(`Téléchargement ${response.status}`);
    await Bun.write(`${directory}/extinguisher-raw.glb`, await response.arrayBuffer());
    const optimized = Bun.spawnSync({
      cmd: ['bunx', '@gltf-transform/cli', 'optimize', `${directory}/extinguisher-raw.glb`, `${directory}/extinguisher.glb`, '--texture-compress', 'webp', '--texture-size', '256', '--simplify-error', '0.005', '--no-compress'],
      stdout: 'inherit', stderr: 'inherit',
    });
    if (optimized.exitCode !== 0) throw new Error('Optimisation du GLB échouée');
    state.status = 'DONE';
    await save();
  }
  console.log('Extincteur: modèle Hunyuan prêt');
} catch (error) {
  state.status = 'FAIL';
  state.error = String(error);
  await save();
  throw error;
}
