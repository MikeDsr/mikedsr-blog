/**
 * 博客的 Worker：静态页面照常由 Cloudflare 直接返回，只有 /api/* 会进到这里。
 *
 * POST /api/hit?path=/posts/xxx/   记一次访问，返回统计
 * GET  /api/stats?path=/posts/xxx/ 只读取统计，不计数
 * 返回：{ pv: 全站访问次数, uv: 全站访客人数, page: 这一页的访问次数 }
 *
 * 数据存在一个 Durable Object（自带 SQLite）里，部署时自动创建，不用手动建数据库。
 * 访客人数按「IP + 浏览器」的哈希去重，不保存原始 IP；同一个人换设备或换网络会被算成新访客，所以是个大概的数。
 */
import { DurableObject } from 'cloudflare:workers';

interface Env {
  ASSETS: Fetcher;
  COUNTER: DurableObjectNamespace<Counter>;
}

type Stats = { pv: number; uv: number; page: number };

export class Counter extends DurableObject<Env> {
  sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS visitors (id TEXT PRIMARY KEY, first_seen INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS pages (path TEXT PRIMARY KEY, pv INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS totals (k TEXT PRIMARY KEY, v INTEGER NOT NULL DEFAULT 0);
    `);
  }

  hit(visitor: string, path: string): Stats {
    this.sql.exec('INSERT OR IGNORE INTO visitors (id, first_seen) VALUES (?, ?)', visitor, Date.now());
    this.sql.exec("INSERT INTO totals (k, v) VALUES ('pv', 1) ON CONFLICT(k) DO UPDATE SET v = v + 1");
    this.sql.exec('INSERT INTO pages (path, pv) VALUES (?, 1) ON CONFLICT(path) DO UPDATE SET pv = pv + 1', path);
    return this.read(path);
  }

  read(path: string): Stats {
    const pv = this.sql.exec<{ v: number }>("SELECT v FROM totals WHERE k = 'pv'").toArray()[0]?.v ?? 0;
    const uv = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM visitors').one().n;
    const page = this.sql.exec<{ pv: number }>('SELECT pv FROM pages WHERE path = ?', path).toArray()[0]?.pv ?? 0;
    return { pv: Number(pv), uv: Number(uv), page: Number(page) };
  }
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

// 只接受站内路径，统一成以 / 结尾，防止乱填撑爆数据
function cleanPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.length > 200) return null;
  let p = raw.split(/[?#]/)[0];
  if (!p.endsWith('/') && !/\.[a-z0-9]+$/i.test(p)) p += '/';
  return p;
}

async function visitorId(req: Request): Promise<string> {
  const ip = req.headers.get('cf-connecting-ip') ?? '';
  const ua = req.headers.get('user-agent') ?? '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}|${ua}|forty-four-sunsets`));
  return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/hit' || url.pathname === '/api/stats') {
      const path = cleanPath(url.searchParams.get('path'));
      if (!path) return json({ error: 'bad path' }, 400);
      const stub = env.COUNTER.get(env.COUNTER.idFromName('site'));
      const isBot = /bot|spider|crawl|slurp|preview|headless|lighthouse/i.test(req.headers.get('user-agent') ?? '');
      if (url.pathname === '/api/hit' && req.method === 'POST' && !isBot) {
        return json(await stub.hit(await visitorId(req), path));
      }
      return json(await stub.read(path));
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
