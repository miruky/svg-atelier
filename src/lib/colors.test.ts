import { describe, expect, it } from 'vitest';
import { collectColors, normalizeColor, replaceWithCurrentColor } from './colors';
import { parseSvg } from './parse';

describe('normalizeColor', () => {
  it('#RGBを#rrggbbへ展開し大文字を畳む', () => {
    expect(normalizeColor('#A1C')).toBe('#aa11cc');
    expect(normalizeColor('#FF5A3C')).toBe('#ff5a3c');
    expect(normalizeColor('Red')).toBe('red');
  });
});

describe('collectColors', () => {
  it('fill・stroke・style内の色を集計する', () => {
    const root = parseSvg(
      `<svg xmlns="http://www.w3.org/2000/svg">
        <path fill="#333" d="M0 0"/>
        <circle stroke="#333" cx="1" cy="1" r="1"/>
        <rect style="fill:#e8b04b;stroke-width:2" width="1" height="1"/>
      </svg>`,
    );
    const colors = collectColors(root);
    expect(colors).toEqual([
      { color: '#333333', count: 2 },
      { color: '#e8b04b', count: 1 },
    ]);
  });

  it('none・currentColor・url参照は数えない', () => {
    const root = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="currentColor" d="M0 0"/><rect fill="url(#g)" width="1" height="1"/></svg>',
    );
    expect(collectColors(root)).toEqual([]);
  });
});

describe('replaceWithCurrentColor', () => {
  it('同値表記(#333と#333333)をまとめて置換する', () => {
    const root = parseSvg(
      `<svg xmlns="http://www.w3.org/2000/svg">
        <path fill="#333" d="M0 0"/>
        <circle stroke="#333333" cx="1" cy="1" r="1"/>
      </svg>`,
    );
    const replaced = replaceWithCurrentColor(root, '#333');
    expect(replaced).toBe(2);
    expect(root.querySelector('path')?.getAttribute('fill')).toBe('currentColor');
    expect(root.querySelector('circle')?.getAttribute('stroke')).toBe('currentColor');
  });

  it('style属性内の色も置換し他のプロパティは保つ', () => {
    const root = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:#e8b04b;stroke-width:2" width="1" height="1"/></svg>',
    );
    replaceWithCurrentColor(root, '#E8B04B');
    expect(root.querySelector('rect')?.getAttribute('style')).toBe(
      'fill:currentColor;stroke-width:2',
    );
  });

  it('指定外の色は触らない', () => {
    const root = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#abc" d="M0 0"/></svg>',
    );
    expect(replaceWithCurrentColor(root, '#333')).toBe(0);
    expect(root.querySelector('path')?.getAttribute('fill')).toBe('#abc');
  });
});
