export class SvgParseError extends Error {}

// SVGをDOMとして読み込む。XMLの構文エラーはparsererror要素として返るため検出して投げる
export function parseSvg(source: string): SVGSVGElement {
  const trimmed = source.trim();
  if (trimmed === '') throw new SvgParseError('SVGが空');

  const doc = new DOMParser().parseFromString(trimmed, 'image/svg+xml');
  const error = doc.querySelector('parsererror');
  if (error) {
    const detail = error.textContent?.split('\n')[0]?.trim() ?? '';
    throw new SvgParseError(`XMLとして読めない: ${detail}`);
  }
  const root = doc.documentElement;
  if (root.tagName.toLowerCase() !== 'svg') {
    throw new SvgParseError(`ルート要素が<svg>ではなく<${root.tagName}>`);
  }
  return root as unknown as SVGSVGElement;
}

export function serializeSvg(root: SVGSVGElement): string {
  return formatXml(new XMLSerializer().serializeToString(root));
}

// XMLSerializerの1行出力を読みやすいインデントに整える。
// テキストノードを持つ要素(title等)は1行のまま保つ
function formatXml(xml: string): string {
  const compact = xml.replace(/>\s+</g, '><');
  const tokens = compact.split(/(?=<)|(?<=>)/g).filter((t) => t !== '');
  let depth = 0;
  let result = '';
  let pendingText = '';

  for (const token of tokens) {
    if (!token.startsWith('<')) {
      pendingText += token;
      continue;
    }
    if (token.startsWith('</')) {
      if (pendingText !== '') {
        result += pendingText + token;
        pendingText = '';
        depth -= 1;
        continue;
      }
      depth -= 1;
      result += `\n${'  '.repeat(depth)}${token}`;
      continue;
    }
    result += result === '' ? token : `\n${'  '.repeat(depth)}${token}`;
    const selfClosing = token.endsWith('/>') || token.startsWith('<?') || token.startsWith('<!');
    if (!selfClosing) depth += 1;
  }
  return result;
}
