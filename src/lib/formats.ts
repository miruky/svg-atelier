// 仕上げたSVGを、用途別の貼り付け形式へ変換する。
// css: CSSのbackgroundに使うURLエンコードのdata URI。base64: img src 等に使う形式。

export type OutputFormat = 'svg' | 'css' | 'base64';

// CSS向けのURLエンコードdata URI。属性のダブルクォートはシングルに寄せ、
// data URIで意味を持つ文字だけを最小限エスケープする(可読性の高い軽量エンコード)。
export function toCssUrl(svg: string): string {
  const oneLine = svg.replace(/\s*\n\s*/g, ' ').trim();
  const encoded = oneLine
    .replace(/"/g, "'")
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/&/g, '%26')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/\s+/g, ' ');
  return `url("data:image/svg+xml,${encoded}")`;
}

// UTF-8を安全にbase64化する(title等に日本語が入っていても壊れない)。
function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// <img src> や CSS で使えるbase64 data URI。
export function toBase64DataUri(svg: string): string {
  const oneLine = svg.replace(/\s*\n\s*/g, ' ').trim();
  return `data:image/svg+xml;base64,${utf8ToBase64(oneLine)}`;
}

export function formatOutput(svg: string, format: OutputFormat): string {
  switch (format) {
    case 'css':
      return toCssUrl(svg);
    case 'base64':
      return toBase64DataUri(svg);
    default:
      return svg;
  }
}
