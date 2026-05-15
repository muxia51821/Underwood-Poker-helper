import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  plugins: [
    // [V6.11.1] CSP 仅生产构建注入，dev 模式不加（避免拦截 Vite HMR）
    {
      name: 'inject-csp',
      transformIndexHtml(html) {
        return html.replace(
          '</head>',
          '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; manifest-src \'self\' data:; worker-src \'self\' blob:"></head>'
        );
      },
      apply: 'build',
    },
    viteSingleFile({
      removeViteModuleLoader: true,
      useRecommendedBuildConfig: true,
      deleteInlinedFiles: true,
    }),
  ],
  build: {
    target: 'es2020',
    minify: 'esbuild',
  },
});
