import { defineConfig } from 'vitest/config';

// GitHub Pagesではリポジトリ名のサブパスで配信されるためbaseを差し替える
export default defineConfig({
  base: process.env.SVG_ATELIER_BASE ?? '/',
  test: {
    // ライブラリはDOMParserを使うためjsdomで実行する
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
