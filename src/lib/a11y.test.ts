import { describe, expect, it } from 'vitest';
import { applyAccessibility, ensureViewBox } from './a11y';
import { parseSvg } from './parse';

const BASE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8"/></svg>';

describe('applyAccessibility', () => {
  it('装飾モードはaria-hiddenを付けtitleを外す', () => {
    const root = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" role="img"><title>old</title><path d="M0 0"/></svg>',
    );
    applyAccessibility(root, 'decorative');
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.hasAttribute('role')).toBe(false);
    expect(root.querySelector('title')).toBeNull();
  });

  it('意味ありモードはrole・aria-label・titleを揃える', () => {
    const root = parseSvg(BASE);
    applyAccessibility(root, 'meaningful', '検索');
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toBe('検索');
    const title = root.querySelector('title');
    expect(title?.textContent).toBe('検索');
    expect(root.firstElementChild?.tagName.toLowerCase()).toBe('title');
  });

  it('既存titleがあれば中身を書き換える', () => {
    const root = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><title>old</title><path d="M0 0"/></svg>',
    );
    applyAccessibility(root, 'meaningful', 'new');
    expect(root.querySelectorAll('title')).toHaveLength(1);
    expect(root.querySelector('title')?.textContent).toBe('new');
  });

  it('装飾から意味ありへの切替でaria-hiddenが消える', () => {
    const root = parseSvg(BASE);
    applyAccessibility(root, 'decorative');
    applyAccessibility(root, 'meaningful', 'icon');
    expect(root.hasAttribute('aria-hidden')).toBe(false);
  });
});

describe('ensureViewBox', () => {
  it('width/heightからviewBoxを補う', () => {
    const root = parseSvg('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"/>');
    const result = ensureViewBox(root, false);
    expect(result.viewBox).toBe('0 0 24 24');
    expect(result.changed).toBe(true);
  });

  it('dropSizeで固定サイズ属性を外す', () => {
    const root = parseSvg('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"/>');
    ensureViewBox(root, true);
    expect(root.hasAttribute('width')).toBe(false);
    expect(root.hasAttribute('height')).toBe(false);
    expect(root.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('サイズ情報が何もなければ変更しない', () => {
    const root = parseSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
    const result = ensureViewBox(root, true);
    expect(result.viewBox).toBeNull();
    expect(result.changed).toBe(false);
  });
});
