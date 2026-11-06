import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

/** 按日期倒序返回文章；线上构建时去掉草稿 */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) =>
    import.meta.env.PROD ? !data.draft : true,
  );
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** 2026-11-06 这样的日期格式 */
export const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

/** 估算阅读时长：中文约 400 字/分钟，英文约 200 词/分钟，代码块不计 */
export function readingMinutes(body = ''): number {
  const text = body.replace(/```[\s\S]*?```/g, '');
  const cjk = (text.match(/[一-鿿]/g) ?? []).length;
  const words = (text.replace(/[一-鿿]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length;
  return Math.max(1, Math.round(cjk / 400 + words / 200));
}
