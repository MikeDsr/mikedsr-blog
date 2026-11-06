// 构建后运行：收集 dist 里用到衬线字体（标题、开场那句话、引言）的字，
// 从 fonts-src 的字库底稿里裁出两份极小的字体，输出到 dist/fonts/。
// 国内访问只需要下载几十 KB；新文章里出现新字也没关系，每次构建都会重新裁剪。
// 如果在 CSS 里给新的地方用了 var(--font-serif)，记得在下面的 HEAVY / LIGHT 里加上对应的标签或 class。
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import subsetFont from 'subset-font';

const DIST = 'dist';
// 粗体（900）：各级标题、卡片标题、导航里的站名、上一篇/下一篇、页脚站名
const HEAVY_TAGS = ['h1', 'h2', 'h3'];
const HEAVY_CLASSES = ['brand', 'pager-link', 'footer-title', 'toc-title', 'section-title', 'page-title', 'comments-title', 'hero-title', 'lost-code', 'profile-name'];
// 常规（500）：开场那句话、首页引言、文章里的引用块
const LIGHT_TAGS = ['blockquote'];
const LIGHT_CLASSES = ['hero-quote', 'intro-line', 'profile-bio'];

const BASE = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ，。、；：？！“”‘’（）《》—…「」 .,:;!?-()';
const heavy = new Set(BASE);
const light = new Set(BASE);

const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
const add = (set, s) => { for (const ch of strip(s)) set.add(ch); };

function collect(html, tags, classes, set) {
  for (const t of tags) {
    for (const m of html.matchAll(new RegExp(`<${t}[\\s>][\\s\\S]*?</${t}>`, 'gi'))) add(set, m[0]);
  }
  for (const c of classes) {
    const re = new RegExp(`<(\\w+)\\b[^>]*class="[^"]*\\b${c}\\b[^"]*"[^>]*>([\\s\\S]*?)</\\1>`, 'g');
    for (const m of html.matchAll(re)) {
      add(set, m[2]);
      const label = m[0].match(/aria-label="([^"]*)"/);
      if (label) add(set, label[1]);
    }
  }
}

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}

for await (const file of walk(DIST)) {
  const html = (await readFile(file, 'utf8')).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  collect(html, HEAVY_TAGS, HEAVY_CLASSES, heavy);
  collect(html, LIGHT_TAGS, LIGHT_CLASSES, light);
}

await mkdir(join(DIST, 'fonts'), { recursive: true });
for (const [src, out, set] of [
  ['fonts-src/NotoSerifSC-Black.gb.woff2', 'serif-900.woff2', heavy],
  ['fonts-src/NotoSerifSC-Medium.gb.woff2', 'serif-500.woff2', light],
]) {
  const font = await subsetFont(await readFile(src), [...set].join(''), { targetFormat: 'woff2' });
  await writeFile(join(DIST, 'fonts', out), font);
  console.log(`[fonts] ${out}: ${set.size} 个字符，${(font.length / 1024).toFixed(1)} KB`);
}
