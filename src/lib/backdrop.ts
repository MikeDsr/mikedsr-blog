import { getImage } from 'astro:assets';
import meadow from '../assets/theme/meadow.webp';
import lavender from '../assets/theme/lavender.webp';

/** 背景图的几档尺寸：电脑用草地横图（960 / 1600 宽），手机用紫色竖图（720 宽），都压缩过 */
export async function backdrop() {
  const [m960, m1600, l720] = await Promise.all([
    getImage({ src: meadow, width: 960, quality: 66, format: 'webp' }),
    getImage({ src: meadow, width: 1600, quality: 70, format: 'webp' }),
    getImage({ src: lavender, width: 720, quality: 66, format: 'webp' }),
  ]);
  return { desktop: m1600.src, desktopSrcset: `${m960.src} 960w, ${m1600.src} 1600w`, mobile: l720.src };
}
