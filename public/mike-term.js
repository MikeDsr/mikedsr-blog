/*
 * <mike-term>：mikedsr.top 全站通用的迷你终端
 *
 * 任何子站引入这一行即可使用：
 *   <script src="https://blog.mikedsr.top/mike-term.js" defer></script>
 *   <mike-term current="blog" paths="archive:/archive/,tags:/tags/,search:/search/"></mike-term>
 *
 * current：当前所在子站的名字（home / blog / note / git）
 * paths：  当前站内可以 cd 进去的页面，格式 名字:路径，用逗号分隔（可省略）
 * 新增子站只要改下面的 SITES。
 */
(() => {
  const SITES = [
    { name: 'home', host: 'mikedsr.top', desc: '主页' },
    { name: 'blog', host: 'blog.mikedsr.top', desc: '博客：四十四次日落之后' },
    { name: 'note', host: 'note.mikedsr.top', desc: '课程笔记' },
    { name: 'git', host: 'git.mikedsr.top', desc: '代码仓库' },
  ];

  const css = `
    :host { position: relative; display: inline-block; font: 13px/1.5 ui-monospace, "Cascadia Code", Consolas, monospace; }
    .box { display: flex; align-items: center; gap: 6px; width: 190px; height: 30px; padding: 0 10px;
      border-radius: 8px; border: 1px solid var(--term-border, rgba(255,255,255,.18));
      background: var(--term-bg, rgba(8,12,30,.55)); color: var(--term-fg, #EDEAF6); cursor: text; transition: border-color .2s, width .25s; }
    .box:hover, .box:focus-within { border-color: var(--term-accent, #F2B544); }
    .box:focus-within { width: 240px; }
    .ps { color: var(--term-accent, #F2B544); white-space: nowrap; }
    input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: inherit; font: inherit; caret-color: var(--term-accent, #F2B544); }
    input::placeholder { color: var(--term-muted, #9A9CC0); }
    .tip { position: absolute; top: calc(100% + 8px); right: 0; padding: 6px 10px; border-radius: 8px; white-space: nowrap;
      background: var(--term-panel, #0B1028); color: var(--term-muted, #B9BBD8); border: 1px solid var(--term-border, rgba(255,255,255,.14));
      opacity: 0; transform: translateY(-4px); pointer-events: none; transition: opacity .2s, transform .2s; z-index: 20; }
    :host(:hover) .tip { opacity: 1; transform: none; }
    :host(.open) .tip { display: none; }
    .out { position: absolute; top: calc(100% + 8px); right: 0; width: 320px; max-height: 260px; overflow: auto; padding: 10px 12px;
      border-radius: 10px; background: var(--term-panel, #0B1028); color: var(--term-fg, #EDEAF6);
      border: 1px solid var(--term-border, rgba(255,255,255,.14)); box-shadow: 0 12px 30px rgba(0,0,0,.35); z-index: 21; }
    .out[hidden] { display: none; }
    .line { white-space: pre-wrap; word-break: break-all; }
    .cmd { color: var(--term-muted, #9A9CC0); }
    .ok { color: #8FD3A8; } .err { color: #FF8F8F; } .acc { color: var(--term-accent, #F2B544); }
    a { color: var(--term-accent, #F2B544); text-decoration: none; } a:hover { text-decoration: underline; }
    @media (max-width: 700px) { .box, .box:focus-within { width: 100%; } :host { display: block; } .out { left: 0; width: auto; } .tip { display: none; } }
  `;

  class MikeTerm extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      const host = location.hostname;
      const guess = (SITES.find((s) => s.host === host) || {}).name;
      this.current = this.getAttribute('current') || guess || 'home';
      this.paths = Object.fromEntries(
        (this.getAttribute('paths') || '').split(',').map((p) => p.split(':')).filter((p) => p.length === 2),
      );
      this.history = [];
      this.hi = 0;

      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${css}</style>
        <label class="box" part="box">
          <span class="ps">~/${this.current} $</span>
          <input type="text" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="help"
                 aria-label="迷你终端，输入 help 查看命令" />
        </label>
        <div class="tip">迷你终端：试试 ls、cd note、help</div>
        <div class="out" hidden role="log" aria-live="polite"></div>`;
      this.input = root.querySelector('input');
      this.out = root.querySelector('.out');

      this.input.addEventListener('keydown', (e) => this.onKey(e));
      document.addEventListener('pointerdown', (e) => { if (!e.composedPath().includes(this)) this.close(); });
    }

    onKey(e) {
      if (e.key === 'Enter') { e.preventDefault(); this.run(this.input.value); this.input.value = ''; }
      else if (e.key === 'Escape') { this.close(); this.input.blur(); }
      else if (e.key === 'ArrowUp' && this.history.length) { e.preventDefault(); this.hi = Math.max(0, this.hi - 1); this.input.value = this.history[this.hi]; }
      else if (e.key === 'ArrowDown' && this.history.length) { e.preventDefault(); this.hi = Math.min(this.history.length, this.hi + 1); this.input.value = this.history[this.hi] || ''; }
      else if (e.key === 'Tab') { e.preventDefault(); this.complete(); }
    }

    names() { return SITES.map((s) => s.name).concat(Object.keys(this.paths)); }

    complete() {
      const m = this.input.value.match(/^cd\s+(\S*)$/);
      if (!m) { if ('cd'.startsWith(this.input.value)) this.input.value = 'cd '; return; }
      const hits = this.names().filter((n) => n.startsWith(m[1]));
      if (hits.length === 1) this.input.value = `cd ${hits[0]}`;
      else if (hits.length > 1) this.print(hits.join('  '), 'acc');
    }

    open() { this.out.hidden = false; this.classList.add('open'); }
    close() { this.out.hidden = true; this.classList.remove('open'); }

    print(text, cls = '') {
      this.open();
      const d = document.createElement('div');
      d.className = `line ${cls}`;
      if (text instanceof Node) d.append(text); else d.textContent = text;
      this.out.append(d);
      while (this.out.children.length > 40) this.out.firstChild.remove();
      this.out.scrollTop = this.out.scrollHeight;
    }

    go(url, label) { this.print(`正在前往 ${label} ...`, 'ok'); setTimeout(() => { location.href = url; }, 350); }

    run(raw) {
      const line = raw.trim();
      if (!line) return;
      this.history.push(line); this.hi = this.history.length;
      this.print(`$ ${line}`, 'cmd');
      const [cmd, ...args] = line.split(/\s+/);
      const arg = args.join(' ');
      switch (cmd) {
        case 'help':
          this.print('ls          列出所有子站\ncd <名字>   进入子站，例如 cd note\ncd ~       回主页\npwd         当前位置\nwhoami      我是谁\nclear       清屏\n按 Tab 补全，按 ↑ ↓ 翻历史');
          break;
        case 'ls': {
          const frag = document.createDocumentFragment();
          for (const s of SITES) {
            const row = document.createElement('div');
            const a = document.createElement('a');
            a.href = `https://${s.host}`; a.textContent = `${s.name}/`;
            row.append(a, document.createTextNode(`${' '.repeat(7 - s.name.length)}${s.desc}${s.name === this.current ? '  ← 你在这里' : ''}`));
            frag.append(row);
          }
          const pages = Object.keys(this.paths);
          if (pages.length) {
            const row = document.createElement('div');
            row.className = 'cmd';
            row.textContent = `本站页面：${pages.join('  ')}`;
            frag.append(row);
          }
          this.print(frag);
          break;
        }
        case 'cd': {
          const t = arg.replace(/\/$/, '');
          if (!t || t === '~' || t === '..' || t === '/') {
            if (this.current === 'home') this.print('已经在主页了');
            else this.go('https://mikedsr.top', '主页');
            break;
          }
          if (t === '.') break;
          const site = SITES.find((s) => s.name === t);
          if (site) {
            if (site.name === this.current) this.print(`已经在 ${site.name} 了`);
            else this.go(`https://${site.host}`, site.desc);
          } else if (this.paths[t]) {
            this.go(this.paths[t], t);
          } else {
            this.print(`cd: 没有叫 ${t} 的地方，输入 ls 看看有哪些`, 'err');
          }
          break;
        }
        case 'pwd': this.print(`${location.host}${location.pathname}`); break;
        case 'whoami': this.print('MikeDsr，北航 2506。'); break;
        case 'clear': this.out.textContent = ''; this.close(); break;
        case 'date': this.print(new Date().toLocaleString('zh-CN')); break;
        case 'echo': this.print(arg); break;
        case 'rose': this.print('你在你的玫瑰身上耗费的时间，使得你的玫瑰变得如此重要。', 'acc'); break;
        case 'sudo': this.print('权限不足：这颗星球上只有一朵玫瑰需要照顾。', 'err'); break;
        default: this.print(`${cmd}: 找不到这个命令，输入 help 看看`, 'err');
      }
    }
  }

  if (!customElements.get('mike-term')) customElements.define('mike-term', MikeTerm);
})();
