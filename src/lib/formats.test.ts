import { describe, expect, it } from 'vitest';
import { formatOutput, toBase64DataUri, toCssUrl } from './formats';

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">\n  <path d="M2 2h4"/>\n</svg>';

describe('toCssUrl', () => {
  it('url() で囲んだ data URI を返す', () => {
    const out = toCssUrl(SVG);
    expect(out.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(out.endsWith('")')).toBe(true);
  });

  it('山括弧と # をエスケープし、" は \' に寄せる', () => {
    const out = toCssUrl('<svg fill="#fff"><a>#</a></svg>');
    expect(out).toContain('%3Csvg');
    expect(out).toContain("fill='%23fff'");
    expect(out).not.toContain('"#');
    expect(out).not.toContain('<svg');
  });

  it('% を最初にエスケープして二重エンコードを避ける', () => {
    expect(toCssUrl('<svg>100%</svg>')).toContain('100%25');
  });

  it('改行を畳んで1行にする', () => {
    expect(toCssUrl(SVG)).not.toContain('\n');
  });
});

describe('toBase64DataUri', () => {
  it('base64 の data URI を返し、復元すると元のSVG(1行)に戻る', () => {
    const out = toBase64DataUri(SVG);
    expect(out.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const b64 = out.slice('data:image/svg+xml;base64,'.length);
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    expect(decoded).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"> <path d="M2 2h4"/> </svg>',
    );
  });

  it('日本語を含むtitleも壊れずに往復する', () => {
    const svg = '<svg><title>検索</title></svg>';
    const out = toBase64DataUri(svg);
    const b64 = out.slice('data:image/svg+xml;base64,'.length);
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    expect(decoded).toContain('検索');
  });
});

describe('formatOutput', () => {
  it('svg はそのまま返す', () => {
    expect(formatOutput(SVG, 'svg')).toBe(SVG);
  });
  it('css と base64 はそれぞれの形式に振り分ける', () => {
    expect(formatOutput(SVG, 'css').startsWith('url(')).toBe(true);
    expect(formatOutput(SVG, 'base64').startsWith('data:image/svg+xml;base64,')).toBe(true);
  });
});
