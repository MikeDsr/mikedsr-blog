// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://blog.mikedsr.top', // RSS、sitemap、canonical 都依赖它
  integrations: [mdx(), sitemap()],
  markdown: {
    // Astro 7 默认用 Sätteri；要接 remark / rehype 插件（数学公式）需切回 unified
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
    // 代码高亮主题，可换成任何 Shiki 内置主题
    shikiConfig: { theme: 'github-dark' },
  },
});
