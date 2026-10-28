import { unlink } from 'node:fs/promises';

const names = ['camel', 'cow', 'horse', 'pig', 'sheep', 'chicken', 'duck', 'bear', 'deer', 'wolf', 'snowWolf', 'snowBear'];
const statePath = '.tmp/hunyuan-animal-jobs.json';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (const name of names) {
  const raw = `assets/models/${name}-raw.glb`;
  const output = `assets/models/${name}.glb`;
  for (;;) {
    const state = await Bun.file(statePath).exists() ? await Bun.file(statePath).json() : {};
    if (state[name]?.status === 'DONE' && await Bun.file(raw).exists()) {
      if (await Bun.file(output).exists()) {
        await unlink(raw);
        console.log(`${name}: déjà optimisé`);
        break;
      }
      const result = Bun.spawnSync({
        cmd: ['bunx', '@gltf-transform/cli', 'optimize', raw, output, '--texture-compress', 'webp', '--texture-size', '256', '--simplify-error', '0.006', '--no-compress'],
        stdout: 'inherit',
        stderr: 'inherit',
      });
      if (result.exitCode !== 0) throw new Error(`${name}: optimisation échouée`);
      await unlink(raw);
      console.log(`${name}: optimisé`);
      break;
    }
    await sleep(5000);
  }
}
