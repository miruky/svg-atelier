import { applyAccessibility, ensureViewBox, type A11yMode } from './lib/a11y';
import { collectColors, replaceWithCurrentColor } from './lib/colors';
import { optimizeSvg } from './lib/optimize';
import { parseSvg, serializeSvg, SvgParseError } from './lib/parse';

const SAMPLE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Some Editor 7.1 -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd" width="24" height="24" sodipodi:docname="star.svg">
  <metadata>editor junk</metadata>
  <path fill="#e8b04b" d="M12.000001 2.333333l2.939231 5.955549 6.572502 0.955049-4.755866 4.635905 1.122732 6.545497L12 17.333333l-5.878599 3.092 1.122732-6.545497L2.488267 9.243931l6.572502-0.955049z"/>
</svg>`;

const LOGO_SVG = `
<svg viewBox="0 0 64 64" width="44" height="44" role="img" aria-label="svg-atelierのロゴ">
  <title>svg-atelier</title>
  <rect x="10" y="10" width="44" height="44" rx="8" fill="none" stroke="currentColor" stroke-width="4"/>
  <path d="M22 42L32 22l10 20" fill="none" stroke="#b07fd4" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M26 35h12" stroke="#b07fd4" stroke-width="4" stroke-linecap="round"/>
</svg>`;

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

  constructor(private readonly root: HTMLElement) {
    this.render();
    this.wire();
  }

  private render(): void {
    this.root.innerHTML = `
      <header class="site-header">
        <span class="logo" aria-hidden="true">${LOGO_SVG}</span>
        <div>
          <h1>svg-atelier</h1>
          <p class="tagline">SVGアイコンの最適化・currentColor化・アクセシビリティ属性付与</p>
        </div>
      </header>
      <main class="columns">
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
    input.addEventListener('input', () => this.update());
    this.el['sample']!.addEventListener('click', () => {
      input.value = SAMPLE_SVG;
      this.currentColorTargets.clear();
      this.update();
    });
    for (const id of ['opt-optimize', 'opt-dropsize', 'a11y-deco', 'a11y-mean']) {
      this.el[id]!.addEventListener('change', () => this.update());
    }
    const label = this.el['label'] as HTMLInputElement;
    label.addEventListener('input', () => this.update());
    this.el['copy']!.addEventListener('click', () => {
      void navigator.clipboard.writeText(this.el['output']!.textContent ?? '');
    });
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

  private update(): void {
    const source = (this.el['input'] as HTMLTextAreaElement).value;
    const error = this.el['error']!;
    const output = this.el['output']!;
    const copy = this.el['copy'] as HTMLButtonElement;

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
        this.update();
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
