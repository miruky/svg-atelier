import { describe, expect, it } from 'vitest';
import { parseSvg, serializeSvg, SvgParseError } from './parse';

describe('parseSvg', () => {
  it('SVGルートを返す', () => {
    const root = parseSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h8"/></svg>');
    expect(root.tagName.toLowerCase()).toBe('svg');
    expect(root.querySelector('path')).not.toBeNull();
  });

  it('空入力を拒否する', () => {
    expect(() => parseSvg('  ')).toThrow('空');
  });

  it('壊れたXMLを検出する', () => {
    expect(() => parseSvg('<svg><path</svg>')).toThrow(SvgParseError);
  });

  it('SVG以外のルート要素を拒否する', () => {
    expect(() => parseSvg('<div>x</div>')).toThrow('ルート要素');
  });
});

describe('serializeSvg', () => {
  it('入れ子をインデントして出力する', () => {
    const root = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><g><circle cx="1" cy="1" r="1"/></g></svg>',
    );
    const text = serializeSvg(root);
    expect(text).toContain('\n  <g>');
    expect(text).toContain('\n    <circle');
    expect(text.trim().endsWith('</svg>')).toBe(true);
  });

  it('titleのテキストは1行に保つ', () => {
    const root = parseSvg('<svg xmlns="http://www.w3.org/2000/svg"><title>icon</title></svg>');
    expect(serializeSvg(root)).toContain('<title>icon</title>');
  });
});
