import type { ImageMetadata } from 'astro';

// 收集 src/assets/photos 和 src/assets/theme 里的图片；文件夹为空也不会报错
const files = import.meta.glob<{ default: ImageMetadata }>(
  ['../assets/photos/*.{jpg,jpeg,png,webp,avif}', '../assets/theme/*.{jpg,jpeg,png,webp,avif}'],
  { eager: true },
);
const byName = (name: string) => {
  const key = Object.keys(files).find((k) => k.endsWith('/' + name));
  return key ? files[key].default : undefined;
};

/** 按文件名找图片，例如 findPhoto('cover-wheat.webp')；找不到返回 undefined */
export function findPhoto(name?: string): ImageMetadata | undefined {
  return name ? byName(name) : undefined;
}

/** 没写 cover 的文章，从主题图里按文章 id 轮流挑一张 */
const defaults = ['cover-wheat.webp', 'cover-lavender.webp', 'cover-planet.webp', 'meadow.webp'];
export function defaultCover(seed: string): ImageMetadata | undefined {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.codePointAt(0)!) >>> 0;
  return byName(defaults[h % defaults.length]);
}
