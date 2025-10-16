import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  splitting: true,
  outDir: 'dist',
  format: ['esm'],
  dts: { entry: { index: 'src/index.ts' } },
  tsconfig: 'tsconfig.json',
  sourcemap: false,
  minify: false,
  clean: true,
  target: 'es2020',
  platform: 'node',
  treeshake: true,
});
