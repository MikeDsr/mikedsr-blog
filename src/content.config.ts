import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  // 读取 src/content/posts 下所有 .md / .mdx，文件名以 _ 开头的忽略
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    series: z.string().optional(),     // 系列名，比如「OO 课程」
    cover: z.string().optional(),      // 封面照片文件名，放在 src/assets/photos/
    coverAlt: z.string().optional(),   // 封面照片的文字描述
    draft: z.boolean().default(false), // 草稿只在本地显示，不会上线
  }),
});

export const collections = { posts };
