// エディタ由来の不要物の除去と数値の整理。描画結果を変えない操作だけを行う

const EDITOR_NS_PREFIXES = [
  'inkscape',
  'sodipodi',
  'sketch',
  'figma',
  'serif',
  'krita',
  'dc',
  'cc',
  'rdf',
  'i',
];
const REMOVE_ELEMENTS = ['metadata', 'sodipodi:namedview', 'namedview'];
const REMOVE_ATTRS = ['data-name', 'enable-background', 'xml:space'];

export interface OptimizeResult {
  removedAttrs: number;
  removedNodes: number;
}

function isEditorAttr(name: string): boolean {
  if (REMOVE_ATTRS.includes(name)) return true;
  const prefix = name.includes(':') ? name.split(':')[0]! : null;
  if (prefix && EDITOR_NS_PREFIXES.includes(prefix)) return true;
  if (name.startsWith('xmlns:') && EDITOR_NS_PREFIXES.includes(name.slice(6))) return true;
  return false;
}

export function optimizeSvg(root: SVGSVGElement, precision = 2): OptimizeResult {
  const result: OptimizeResult = { removedAttrs: 0, removedNodes: 0 };
  removeJunkNodes(root, result);

  const walker: Element[] = [root];
  while (walker.length > 0) {
    const el = walker.pop()!;
    for (const attr of [...el.attributes]) {
      if (isEditorAttr(attr.name)) {
        el.removeAttribute(attr.name);
        result.removedAttrs += 1;
      } else if (attr.name === 'd' || attr.name === 'points') {
        el.setAttribute(attr.name, roundNumbers(attr.value, precision));
      } else if (/^-?\d*\.\d{3,}$/.test(attr.value.trim())) {
        el.setAttribute(attr.name, roundNumbers(attr.value, precision));
      }
    }
    walker.push(...Array.from(el.children));
  }

  // 中身が空になったdefsやgは取り除く
  for (const el of [...root.querySelectorAll('defs, g')]) {
    if (el.children.length === 0 && el.attributes.length === 0) {
      el.remove();
      result.removedNodes += 1;
    }
  }
  return result;
}

function removeJunkNodes(root: SVGSVGElement, result: OptimizeResult): void {
  const doomed: ChildNode[] = [];
  const visit = (node: ChildNode): void => {
    if (node.nodeType === 8) {
      // コメント
      doomed.push(node);
      return;
    }
    if (node.nodeType === 1) {
      const el = node as Element;
      const name = el.tagName.toLowerCase();
      const prefix = name.includes(':') ? name.split(':')[0]! : null;
      if (REMOVE_ELEMENTS.includes(name) || (prefix && EDITOR_NS_PREFIXES.includes(prefix))) {
        doomed.push(node);
        return;
      }
    }
    node.childNodes.forEach(visit);
  };
  root.childNodes.forEach(visit);
  for (const node of doomed) {
    node.remove();
    result.removedNodes += 1;
  }
}

// パスデータや属性値の中の数値を指定桁で丸める。整数はそのまま
export function roundNumbers(value: string, precision: number): string {
  return value.replace(/-?\d*\.\d+(?:e-?\d+)?/gi, (num) => {
    const rounded = Number.parseFloat(Number.parseFloat(num).toFixed(precision));
    return String(rounded);
  });
}
