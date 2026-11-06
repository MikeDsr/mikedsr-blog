import type { ImageMetadata } from 'astro';

// 收集 src/assets/photos 里的所有照片；文件夹为空也不会报错
const files = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/photos/*.{jpg,jpeg,png,webp,avif}',
  { eager: true },
);

/** 按文件名找照片，例如 findPhoto('mikedsr-cover-silk.webp')；找不到返回 undefined */
export function findPhoto(name?: string): ImageMetadata | undefined {
  if (!name) return undefined;
  const key = Object.keys(files).find((k) => k.endsWith('/' + name));
  return key ? files[key].default : undefined;
}

/** 按前缀找照片，例如 findPhotoByPrefix('mikedsr-hero') 会匹配 .webp 或 .jpg */
export function findPhotoByPrefix(prefix: string): ImageMetadata | undefined {
  const key = Object.keys(files).find((k) => k.split('/').pop()!.startsWith(prefix));
  return key ? files[key].default : undefined;
}
