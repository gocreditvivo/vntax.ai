import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveRuntimeMode, validateSupabaseEnv } from './src/lib/env';

type SupabaseConfiguration = 'absent' | 'valid' | 'invalid';

function releaseManifestPlugin(manifest: Record<string, unknown>): Plugin {
  return {
    name: 'vntax-release-manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'vntax-build-manifest.json',
        source: `${JSON.stringify(manifest, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const buildEnv = loadEnv(mode, process.cwd(), 'VITE_');
  const supabaseUrl = buildEnv.VITE_SUPABASE_URL?.trim() ?? '';
  const supabaseKey = buildEnv.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
  const syntheticDemoRequested = buildEnv.VITE_ENABLE_SYNTHETIC_DEMO === 'true';
  const supabaseState = validateSupabaseEnv(supabaseUrl, supabaseKey);
  const supabaseConfiguration: SupabaseConfiguration =
    !supabaseUrl && !supabaseKey ? 'absent' : supabaseState.configured ? 'valid' : 'invalid';
  const runtimeSurface = resolveRuntimeMode(supabaseState.configured, syntheticDemoRequested);

  return {
    plugins: [
      react(),
      releaseManifestPlugin({
        schemaVersion: 1,
        product: 'vntax',
        runtimeSurface,
        supabaseConfiguration,
        syntheticDemoRequested,
        sourceMaps: false,
      }),
    ],
    build: {
      sourcemap: false,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/tests/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
