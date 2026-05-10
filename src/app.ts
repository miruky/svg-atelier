import { applyAccessibility, ensureViewBox, type A11yMode } from './lib/a11y';
import { collectColors, replaceWithCurrentColor } from './lib/colors';
import { formatOutput, type OutputFormat } from './lib/formats';
import { optimizeSvg } from './lib/optimize';
import { parseSvg, serializeSvg, SvgParseError } from './lib/parse';
import { applyTheme, loadTheme, nextTheme, THEME_LABEL, type ThemeMode } from './theme';

// サイズ確認のプレビューに使うアイコンサイズ(px)。
const RAMP_SIZES = [16, 20, 24, 32, 48];

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
  // 直近の最適化済みSVG(出力形式の切替やダウンロードの元になる正本)。
  private lastSvg = '';
  private format: OutputFormat = 'svg';
  // 直近に集計した置換可能な色(一括currentColor化のため)。
  private lastColors: string[] = [];

  constructor(private readonly root: HTMLElement) {
    this.render();
    this.wire();
    this.restore();
    this.update();
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
            aria-label="SVG入力" placeholder="SVGをここに貼る"></textarea>
          <p class="parse-error" data-id="error" role="alert" hidden></p>
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
            <div class="opt-row">
              <span>小数の精度:</span>
              <select data-id="precision" class="opt-select" aria-label="座標の小数桁">
                <option value="0">0桁</option>
                <option value="1">1桁</option>
                <option value="2" selected>2桁</option>
                <option value="3">3桁</option>
              </select>
            </div>
          </div>
          <div class="pane-head">
            <h2>色 → currentColor</h2>
            <button type="button" class="ghost-btn" data-id="all-current" hidden>すべてcurrentColorに</button>
          </div>
          <p class="hint">クリックした色をcurrentColorに置き換える。テーマの文字色に追従するようになる</p>
          <div class="color-list" data-id="colors"></div>
        </section>
        <section class="pane">
          <h2>プレビュー</h2>
          <div class="preview-grid" data-id="previews"></div>
          <h2>サイズ確認</h2>
          <div class="size-ramp" data-id="ramp" role="img" aria-label="複数サイズでの見え方"></div>
          <div class="pane-head">
            <h2>出力</h2>
            <span class="out-actions">
              <span class="size-note" data-id="sizes"></span>
              <button type="button" class="ghost-btn" data-id="download" disabled>ダウンロード</button>
              <button type="button" class="primary-btn" data-id="copy" disabled>コピー</button>
            </span>
          </div>
          <div class="format-tabs" role="tablist" aria-label="出力形式">
            <button type="button" class="format-tab is-active" role="tab" aria-selected="true" data-id="fmt-svg" data-fmt="svg">SVG</button>
            <button type="button" class="format-tab" role="tab" aria-selected="false" data-id="fmt-css" data-fmt="css">CSS</button>
            <button type="button" class="format-tab" role="tab" aria-selected="false" data-id="fmt-base64" data-fmt="base64">Base64</button>
          </div>
          <pre class="code-view" data-id="output">(SVGを貼ると変換結果が表示される)</pre>
          <p class="opt-summary" data-id="opt-summary"></p>
          <span class="sr-only" data-id="status" role="status" aria-live="polite"></span>
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
    for (const id of ['opt-optimize', 'opt-dropsize', 'a11y-deco', 'a11y-mean', 'precision']) {
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
      this.el['status']!.textContent = `出力を${message}`;
      window.clearTimeout(this.copyTimer);
      this.copyTimer = window.setTimeout(() => {
        copy.textContent = 'コピー';
        this.el['status']!.textContent = '';
      }, 1400);
    });
    for (const fmt of ['svg', 'css', 'base64'] as const) {
      this.el[`fmt-${fmt}`]!.addEventListener('click', () => this.setFormat(fmt));
    }
    this.el['all-current']!.addEventListener('click', () => {
      const allActive =
        this.lastColors.length > 0 && this.lastColors.every((c) => this.currentColorTargets.has(c));
      for (const color of this.lastColors) {
        if (allActive) this.currentColorTargets.delete(color);
        else this.currentColorTargets.add(color);
      }
      this.update(true);
    });
    this.el['download']!.addEventListener('click', () => {
      const text = this.lastSvg;
      if (!text) return;
      const blob = new Blob([text], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'icon.svg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      this.el['status']!.textContent = 'icon.svg をダウンロードしました';
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
      precision: Number((this.el['precision'] as HTMLSelectElement).value),
      dropSize: (this.el['opt-dropsize'] as HTMLInputElement).checked,
      a11yMode: meaningful ? 'meaningful' : 'decorative',
      label: (this.el['label'] as HTMLInputElement).value,
    };
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem('svg-atelier.session');
      if (!raw) return;
      const s = JSON.parse(raw) as Record<string, unknown>;
      if (typeof s.input === 'string') (this.el['input'] as HTMLTextAreaElement).value = s.input;
      (this.el['opt-optimize'] as HTMLInputElement).checked = s.optimize !== false;
      (this.el['opt-dropsize'] as HTMLInputElement).checked = s.dropSize !== false;
      const meaningful = s.a11y === 'meaningful';
      (this.el['a11y-mean'] as HTMLInputElement).checked = meaningful;
      (this.el['a11y-deco'] as HTMLInputElement).checked = !meaningful;
      if (typeof s.label === 'string') (this.el['label'] as HTMLInputElement).value = s.label;
      if (typeof s.precision === 'string') {
        (this.el['precision'] as HTMLSelectElement).value = s.precision;
      }
    } catch {
      // 壊れた保存値は無視する
    }
  }

  private save(): void {
    try {
      localStorage.setItem(
        'svg-atelier.session',
        JSON.stringify({
          input: (this.el['input'] as HTMLTextAreaElement).value,
          optimize: (this.el['opt-optimize'] as HTMLInputElement).checked,
          dropSize: (this.el['opt-dropsize'] as HTMLInputElement).checked,
          a11y: (this.el['a11y-mean'] as HTMLInputElement).checked ? 'meaningful' : 'decorative',
          label: (this.el['label'] as HTMLInputElement).value,
          precision: (this.el['precision'] as HTMLSelectElement).value,
        }),
      );
    } catch {
      // 保存できなくても動作には影響しない
    }
  }

  private update(animate = false): void {
    const source = (this.el['input'] as HTMLTextAreaElement).value;
    const error = this.el['error']!;
    const output = this.el['output']!;
    const copy = this.el['copy'] as HTMLButtonElement;
    const download = this.el['download'] as HTMLButtonElement;
    this.save();
    // 再構築のたびに自動再生しないよう、まずアニメーション用クラスを外す
    this.el['previews']!.classList.remove('is-updated');
    output.classList.remove('is-updated');

    if (source.trim() === '') {
      error.hidden = true;
      this.lastSvg = '';
      this.lastColors = [];
      output.textContent = '(SVGを貼ると変換結果が表示される)';
      this.el['colors']!.innerHTML = '';
      this.el['previews']!.innerHTML = '';
      this.el['ramp']!.innerHTML = '';
      this.el['sizes']!.textContent = '';
      this.el['opt-summary']!.textContent = '';
      (this.el['all-current'] as HTMLButtonElement).hidden = true;
      copy.disabled = true;
      download.disabled = true;
      return;
    }

    let root: SVGSVGElement;
    try {
      root = parseSvg(source);
    } catch (cause) {
      error.textContent = cause instanceof SvgParseError ? cause.message : '解析に失敗した';
      error.hidden = false;
      this.lastSvg = '';
      this.el['opt-summary']!.textContent = '';
      copy.disabled = true;
      download.disabled = true;
      return;
    }
    error.hidden = true;

    const opts = this.options();
    const optResult = opts.optimize
      ? optimizeSvg(root, opts.precision)
      : { removedAttrs: 0, removedNodes: 0 };
    ensureViewBox(root, opts.dropSize);
    applyAccessibility(root, opts.a11yMode, opts.label);

    // 置換対象に選ばれている色を変換(集計は置換前の色で行う)
    const colors = collectColors(root);
    this.lastColors = colors.map((c) => c.color);
    for (const target of this.currentColorTargets) {
      replaceWithCurrentColor(root, target);
    }

    const result = serializeSvg(root);
    this.lastSvg = result;
    this.renderOutput();
    copy.disabled = false;
    download.disabled = false;
    const sourceBytes = new Blob([source]).size;
    const resultBytes = new Blob([result]).size;
    this.el['sizes']!.textContent = `${sourceBytes} B から ${resultBytes} B へ`;
    this.renderOptSummary(sourceBytes, resultBytes, optResult);
    this.renderColors(colors);
    this.renderPreviews(result);
    this.renderSizeRamp(result);

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
    const allBtn = this.el['all-current'] as HTMLButtonElement;
    if (this.lastColors.length === 0) {
      allBtn.hidden = true;
    } else {
      allBtn.hidden = false;
      const allActive = this.lastColors.every((c) => this.currentColorTargets.has(c));
      allBtn.textContent = allActive ? 'currentColorを解除' : 'すべてcurrentColorに';
    }

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

  // 実寸の複数サイズで並べ、小さなアイコンサイズでも形が保てるか確かめる。
  private renderSizeRamp(svgText: string): void {
    const ramp = this.el['ramp']!;
    ramp.innerHTML = '';
    for (const size of RAMP_SIZES) {
      const cell = document.createElement('div');
      cell.className = 'ramp-cell';
      const art = document.createElement('div');
      art.className = 'ramp-art';
      art.style.width = `${size}px`;
      art.style.height = `${size}px`;
      art.innerHTML = svgText;
      const caption = document.createElement('span');
      caption.textContent = `${size}`;
      cell.append(art, caption);
      ramp.appendChild(cell);
    }
  }

  // 削減率と除去した不要物の件数を一行で伝える。
  private renderOptSummary(
    sourceBytes: number,
    resultBytes: number,
    opt: { removedAttrs: number; removedNodes: number },
  ): void {
    const parts: string[] = [];
    const reduction = sourceBytes > 0 ? Math.round((1 - resultBytes / sourceBytes) * 100) : 0;
    if (reduction > 0) parts.push(`${reduction}%削減`);
    const removed: string[] = [];
    if (opt.removedNodes > 0) removed.push(`要素${opt.removedNodes}件`);
    if (opt.removedAttrs > 0) removed.push(`属性${opt.removedAttrs}個`);
    if (removed.length > 0) parts.push(`不要な${removed.join('・')}を除去`);
    this.el['opt-summary']!.textContent = parts.join(' ・ ');
  }

  private setFormat(format: OutputFormat): void {
    this.format = format;
    for (const fmt of ['svg', 'css', 'base64'] as const) {
      const tab = this.el[`fmt-${fmt}`]!;
      const active = fmt === format;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    }
    this.renderOutput();
  }

  // 正本のSVGを、選択中の形式に変換して出力欄へ描く。
  private renderOutput(): void {
    if (!this.lastSvg) return;
    this.el['output']!.textContent = formatOutput(this.lastSvg, this.format);
  }
}
