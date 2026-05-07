// アクセシビリティ属性の付与。装飾アイコンは読み上げから隠し、
// 意味を持つアイコンにはtitleとロールを与える

export type A11yMode = 'decorative' | 'meaningful';

export function applyAccessibility(root: SVGSVGElement, mode: A11yMode, label = ''): void {
  const doc = root.ownerDocument;
  const existingTitle = root.querySelector(':scope > title');

  if (mode === 'decorative') {
    root.setAttribute('aria-hidden', 'true');
    root.removeAttribute('role');
    root.removeAttribute('aria-label');
    existingTitle?.remove();
    return;
  }

  root.removeAttribute('aria-hidden');
  root.setAttribute('role', 'img');
  if (label.trim() !== '') {
    root.setAttribute('aria-label', label.trim());
    let title = existingTitle;
    if (!title) {
      title = doc.createElementNS('http://www.w3.org/2000/svg', 'title');
      root.insertBefore(title, root.firstChild);
    }
    title.textContent = label.trim();
  }
}

// viewBoxがなければwidth/heightから補い、固定サイズ属性を外してスケーラブルにする
export interface ViewBoxResult {
  viewBox: string | null;
  changed: boolean;
}

export function ensureViewBox(root: SVGSVGElement, dropSize: boolean): ViewBoxResult {
  let changed = false;
  if (!root.hasAttribute('viewBox')) {
    const width = Number.parseFloat(root.getAttribute('width') ?? '');
    const height = Number.parseFloat(root.getAttribute('height') ?? '');
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      root.setAttribute('viewBox', `0 0 ${width} ${height}`);
      changed = true;
    }
  }
  if (dropSize && root.hasAttribute('viewBox')) {
    if (root.hasAttribute('width') || root.hasAttribute('height')) {
      root.removeAttribute('width');
      root.removeAttribute('height');
      changed = true;
    }
  }
  return { viewBox: root.getAttribute('viewBox'), changed };
}
