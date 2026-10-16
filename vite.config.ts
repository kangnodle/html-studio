import { defineConfig, lazyPlugins } from 'vite-plus';
import solid from 'vite-plugin-solid';

export default defineConfig({
  run: {
    tasks: {
      'dev:desktop': {
        command: 'vp exec tauri dev',
        cache: false,
      },
      'build:desktop': {
        command: 'vp exec tauri build --no-bundle',
        cache: false,
      },
      'package:windows': {
        command: 'vp exec tauri build --bundles nsis',
        cache: false,
      },
      'format:rust': {
        command: 'cargo fmt --manifest-path src-tauri/Cargo.toml',
        cache: false,
      },
      'test:rust': {
        command: 'cargo test --locked --manifest-path src-tauri/Cargo.toml',
        cache: false,
      },
    },
  },
  test: {
    environment: 'node',
  },
  lint: {
    rules: {
      'no-unassigned-vars': 'off',
      'typescript/unbound-method': 'off',
    },
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    singleQuote: true,
    sortPackageJson: false,
  },
  base: './',
  plugins: lazyPlugins(() => [solid()]),
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
});
