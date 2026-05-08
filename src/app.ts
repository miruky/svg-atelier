import { applyAccessibility, ensureViewBox, type A11yMode } from './lib/a11y';
import { collectColors, replaceWithCurrentColor } from './lib/colors';
import { optimizeSvg } from './lib/optimize';
import { parseSvg, serializeSvg, SvgParseError } from './lib/parse';
import { applyTheme, loadTheme, nextTheme, THEME_LABEL, type ThemeMode } from './theme';

const SAMPLE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Some Editor 7.1 -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd" width="24" height="24" sodipodi:docname="star.svg">
  <metadata>editor junk</metadata>
  <path fill="#e8b04b" d="M12.000001 2.333333l2.939231 5.955549 6.572502 0.955049-4.755866 4.635905 1.122732 6.545497L12 17.333333l-5.878599 3.092 1.122732-6.545497L2.488267 9.243931l6.572502-0.955049z"/>
</svg>`;

const BRAND_MARK = `
<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7">
  <rect x="3.5" y="3.5" width="17" height="17" rx="4"/>
  <path d="M6.8 16l3.4-4.8 2.4 3 2-2.5L17.2 16" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const THEME_ICON: Record<ThemeMode, string> = {
  light: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
    <circle cx="12" cy="12" r="4.2"/>
    <path d="M12 3v2.4M12 18.6V21M4.5 4.5l1.7 1.7M17.8 17.8l1.7 1.7M3 12h2.4M18.6 12H21M4.5 19.5l1.7-1.7M17.8 6.2l1.7-1.7"/>
  </svg>`,
  dark: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 14.2A7.5 7.5 0 0 1 9.8 4 7.5 7.5 0 1 0 20 14.2z"/>
  </svg>`,
  auto: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7">
    <circle cx="12" cy="12" r="8.4"/>
    <path d="M12 3.6a8.4 8.4 0 0 1 0 16.8z" fill="currentColor" stroke="none"/>
  </svg>`,
};

interface Options {
  optimize: boolean;
  precision: number;
  dropSize: boolean;
  a11yMode: A11yMode;
  label: string;
}

export class App {
  private readonly el: Record<string, HTMLElement> = {};
  private currentColorTargets = new Set<string>();
  private theme: ThemeMode = loadTheme();
  private copyTimer: number | undefined;

  constructor(private readonly root: HTMLElement) {
    this.render();
    this.wire();
  }

  private render(): void {
    this.root.innerHTML = `
      <a class="skip-link" href="#work">本文へ移動</a>
      <header class="topbar">
        <div class="topbar-inner">
          <a class="brand" href="./" aria-label="svg-atelier ホーム">
            <span class="brand-mark">${BRAND_MARK}</span>
            <span class="brand-name">svg-atelier</span>
          </a>
          <button type="button" class="theme-toggle" data-id="theme"></button>
        </div>
      </header>
      <div class="shell">
      <div class="intro">
        <p class="kicker">svg icon editor</p>
        <h1>SVGアイコンの最適化と仕上げ</h1>
        <p class="tagline">エディタ由来のメタデータを削り、色を currentColor に置き換え、用途に応じたアクセシビリティ属性を付けて書き出します。</p>
      </div>
      <main id="work" class="columns">
        <section class="pane">
          <div class="pane-head">
            <h2>入力</h2>
            <button type="button" class="ghost-btn" data-id="sample">サンプルを読み込む</button>
          </div>
          <textarea data-id="input" rows="12" spellcheck="false"
            placeholder="SVGをここに貼る"></textarea>
          <p class="parse-error" data-id="error" hidden></p>
          <h2>処理</h2>
          <div class="options">
            <label class="opt-row"><input type="checkbox" data-id="opt-optimize" checked>
              エディタ由来のメタデータ・コメントを除去し数値を丸める</label>
            <label class="opt-row"><input type="checkbox" data-id="opt-dropsize" checked>
              viewBoxを確保して固定width/heightを外す</label>
            <div class="opt-row">
              <span>用途:</span>
              <label><input type="radio" name="a11y" value="decorative" data-id="a11y-deco" checked> 装飾(aria-hidden)</label>
              <label><input type="radio" name="a11y" value="meaningful" data-id="a11y-mean"> 意味あり(role+title)</label>
              <input type="text" data-id="label" class="label-input" placeholder="ラベル(例: 検索)" disabled>
            </div>
          </div>
          <h2>色 → currentColor</h2>
          <p class="hint">クリックした色をcurrentColorに置き換える。テーマの文字色に追従するようになる</p>
          <div class="color-list" data-id="colors"></div>
        </section>
        <section class="pane">
          <h2>プレビュー</h2>
          <div class="preview-grid" data-id="previews"></div>
          <div class="pane-head">
            <h2>出力</h2>
            <span>
              <span class="size-note" data-id="sizes"></span>
              <button type="button" class="primary-btn" data-id="copy" disabled>コピー</button>
            </span>
          </div>
          <pre class="code-view" data-id="output">(SVGを貼ると変換結果が表示される)</pre>
        </section>
      </main>
      </div>
      <footer class="site-footer">
        <p>変換はすべてブラウザ内で行われ、SVGはどこにも送信されない。アニメーションSVGとscript入りSVGの動作は保証しない。</p>
      </footer>
    `;
    this.root.querySelectorAll<HTMLElement>('[data-id]').forEach((node) => {
      this.el[node.dataset.id ?? ''] = node;
    });
  }

  private wire(): void {
    const input = this.el['input'] as HTMLTextAreaElement;
    input.addEventListener('input', () => this.update(false));
    this.el['sample']!.addEventListener('click', () => {
      input.value = SAMPLE_SVG;
      this.currentColorTargets.clear();
      this.update(true);
    });
    for (const id of ['opt-optimize', 'opt-dropsize', 'a11y-deco', 'a11y-mean']) {
      this.el[id]!.addEventListener('change', () => this.update(true));
    }
    const label = this.el['label'] as HTMLInputElement;
    label.addEventListener('input', () => this.update(false));
    const copy = this.el['copy'] as HTMLButtonElement;
    copy.addEventListener('click', async () => {
      const text = this.el['output']!.textContent ?? '';
      let message = 'コピーしました';
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        message = 'コピーできません';
      }
      copy.textContent = message;
      window.clearTimeout(this.copyTimer);
      this.copyTimer = window.setTimeout(() => {
        copy.textContent = 'コピー';
      }, 1400);
    });
    this.el['theme']!.addEventListener('click', () => {
      this.theme = nextTheme(this.theme);
      this.renderTheme();
    });
    this.renderTheme();
  }

  private renderTheme(): void {
    applyTheme(this.theme);
    const label = THEME_LABEL[this.theme];
    const btn = this.el['theme']!;
    btn.innerHTML = `${THEME_ICON[this.theme]}<span>${label}</span>`;
    btn.setAttribute('aria-label', `配色: ${label}(クリックで切り替え)`);
  }

  private options(): Options {
    const meaningful = (this.el['a11y-mean'] as HTMLInputElement).checked;
    (this.el['label'] as HTMLInputElement).disabled = !meaningful;
    return {
      optimize: (this.el['opt-optimize'] as HTMLInputElement).checked,
      precision: 2,
      dropSize: (this.el['opt-dropsize'] as HTMLInputElement).checked,
      a11yMode: meaningful ? 'meaningful' : 'decorative',
      label: (this.el['label'] as HTMLInputElement).value,
    };
  }

  private update(animate = false): void {
    const source = (this.el['input'] as HTMLTextAreaElement).value;
    const error = this.el['error']!;
    const output = this.el['output']!;
    const copy = this.el['copy'] as HTMLButtonElement;
    // 再構築のたびに自動再生しないよう、まずアニメーション用クラスを外す
    this.el['previews']!.classList.remove('is-updated');
    output.classList.remove('is-updated');

    if (source.trim() === '') {
      error.hidden = true;
      output.textContent = '(SVGを貼ると変換結果が表示される)';
      this.el['colors']!.innerHTML = '';
      this.el['previews']!.innerHTML = '';
      this.el['sizes']!.textContent = '';
      copy.disabled = true;
      return;
    }

    let root: SVGSVGElement;
    try {
      root = parseSvg(source);
    } catch (cause) {
      error.textContent = cause instanceof SvgParseError ? cause.message : '解析に失敗した';
      error.hidden = false;
      copy.disabled = true;
      return;
    }
    error.hidden = true;

    const opts = this.options();
    if (opts.optimize) optimizeSvg(root, opts.precision);
    ensureViewBox(root, opts.dropSize);
    applyAccessibility(root, opts.a11yMode, opts.label);

    // 置換対象に選ばれている色を変換(集計は置換前の色で行う)
    const colors = collectColors(root);
    for (const target of this.currentColorTargets) {
      replaceWithCurrentColor(root, target);
    }

    const result = serializeSvg(root);
    output.textContent = result;
    copy.disabled = false;
    this.el['sizes']!.textContent =
      `${new Blob([source]).size} B から ${new Blob([result]).size} B へ`;
    this.renderColors(colors);
    this.renderPreviews(result);

    if (animate) {
      void this.el['previews']!.offsetWidth;
      this.el['previews']!.classList.add('is-updated');
      output.classList.add('is-updated');
    }
  }

  private renderColors(colors: Array<{ color: string; count: number }>): void {
    const list = this.el['colors']!;
    list.innerHTML = '';
    const entries = [
      ...colors.map((c) => ({ ...c, active: this.currentColorTargets.has(c.color) })),
      ...[...this.currentColorTargets]
        .filter((color) => !colors.some((c) => c.color === color))
        .map((color) => ({ color, count: 0, active: true })),
    ];
    if (entries.length === 0) {
      list.textContent = '置き換え可能な色は残っていない';
      return;
    }
    for (const entry of entries) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = entry.active ? 'color-chip active' : 'color-chip';
      btn.innerHTML =
        `<i style="background:${entry.color}"></i><code>${entry.color}</code>` +
        (entry.active ? '<span>currentColor</span>' : `<span>${entry.count}箇所</span>`);
      btn.addEventListener('click', () => {
        if (entry.active) this.currentColorTargets.delete(entry.color);
        else this.currentColorTargets.add(entry.color);
        this.update(true);
      });
      list.appendChild(btn);
    }
  }

  private renderPreviews(svgText: string): void {
    const grid = this.el['previews']!;
    grid.innerHTML = '';
    const variants: Array<[string, string]> = [
      ['ライト', 'preview-light'],
      ['ダーク', 'preview-dark'],
      ['アクセント', 'preview-accent'],
    ];
    for (const [name, className] of variants) {
      const cell = document.createElement('div');
      cell.className = `preview-cell ${className}`;
      const holder = document.createElement('div');
      holder.className = 'preview-art';
      holder.innerHTML = svgText;
      const caption = document.createElement('span');
      caption.textContent = name;
      cell.append(holder, caption);
      grid.appendChild(cell);
    }
  }
}
