import { describe, expect, it } from 'vitest';
import { optimizeSvg, roundNumbers } from './optimize';
import { parseSvg, serializeSvg } from './parse';

describe('optimizeSvg', () => {
  it('コメントとmetadataを取り除く', () => {
    const root = parseSvg(
      `<svg xmlns="http://www.w3.org/2000/svg">
        <!-- Generator: Some Editor -->
        <metadata>junk</metadata>
        <path d="M0 0h8"/>
      </svg>`,
    );
    const result = optimizeSvg(root);
    const text = serializeSvg(root);
    expect(text).not.toContain('Generator');
    expect(text).not.toContain('metadata');
    expect(result.removedNodes).toBe(2);
  });

  it('エディタ名前空間の属性と要素を取り除く', () => {
    const root = parseSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:version="1.3">
        <sodipodi:namedview xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd" id="nv"/>
        <path inkscape:label="layer" d="M0 0h8"/>
      </svg>`,
    );
    optimizeSvg(root);
    const text = serializeSvg(root);
    expect(text).not.toContain('inkscape');
    expect(text).not.toContain('sodipodi');
    expect(text).toContain('<path d="M0 0h8"/>');
  });

  it('パスの数値を指定精度に丸める', () => {
    const root = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0.333333 0.666667L11.999999 4.000001"/></svg>',
    );
    optimizeSvg(root, 2);
    expect(root.querySelector('path')?.getAttribute('d')).toBe('M0.33 0.67L12 4');
  });

  it('空になったdefsを取り除く', () => {
    const root = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><defs></defs><path d="M0 0h8"/></svg>',
    );
    optimizeSvg(root);
    expect(serializeSvg(root)).not.toContain('defs');
  });

  it('描画に関わる要素と属性は残す', () => {
    const source =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8" fill="#333"/></svg>';
    const root = parseSvg(source);
    optimizeSvg(root);
    expect(root.getAttribute('viewBox')).toBe('0 0 8 8');
    expect(root.querySelector('path')?.getAttribute('fill')).toBe('#333');
  });
});

describe('roundNumbers', () => {
  it('小数だけを丸め、整数と指数表記を扱う', () => {
    expect(roundNumbers('M1.23456 7 8.999', 2)).toBe('M1.23 7 9');
    expect(roundNumbers('1.5e-7', 2)).toBe('0');
  });

  it('精度を変えると丸め桁が変わる', () => {
    expect(roundNumbers('M0.55555 1.44', 0)).toBe('M1 1');
    expect(roundNumbers('M0.55555 1.44', 1)).toBe('M0.6 1.4');
    expect(roundNumbers('M0.12345', 3)).toBe('M0.123');
  });
});
