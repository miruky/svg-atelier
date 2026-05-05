// fill / stroke / stop-color と style属性内の色を集計し、選んだ色をcurrentColorへ置き換える

const COLOR_ATTRS = ['fill', 'stroke', 'stop-color', 'color'];
const STYLE_COLOR_PROPS = ['fill', 'stroke', 'stop-color', 'color'];
const NOT_COLORS = new Set(['none', 'currentColor', 'inherit', 'transparent']);

function isColorValue(value: string): boolean {
  const v = value.trim();
  if (v === '' || NOT_COLORS.has(v) || v.startsWith('url(')) return false;
  return true;
}

// 比較のために色表記を正規化する。#RGB → #rrggbb、それ以外は小文字化のみ
export function normalizeColor(value: string): string {
  const v = value.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return v;
}

function styleEntries(el: Element): Array<[string, string]> {
  const style = el.getAttribute('style');
  if (!style) return [];
  return style
    .split(';')
    .map((entry) => entry.split(':'))
    .filter((pair): pair is [string, string] => pair.length === 2)
    .map(([prop, value]) => [prop!.trim(), value!.trim()]);
}

export interface ColorUsage {
  color: string;
  count: number;
}

export function collectColors(root: SVGSVGElement): ColorUsage[] {
  const counts = new Map<string, number>();
  const note = (value: string) => {
    if (!isColorValue(value)) return;
    const color = normalizeColor(value);
    counts.set(color, (counts.get(color) ?? 0) + 1);
  };
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attr of COLOR_ATTRS) {
      const value = el.getAttribute(attr);
      if (value) note(value);
    }
    for (const [prop, value] of styleEntries(el)) {
      if (STYLE_COLOR_PROPS.includes(prop)) note(value);
    }
  }
  return [...counts.entries()]
    .map(([color, count]) => ({ color, count }))
    .sort((a, b) => b.count - a.count || a.color.localeCompare(b.color));
}

// 指定色をcurrentColorへ置き換え、置換箇所数を返す
export function replaceWithCurrentColor(root: SVGSVGElement, color: string): number {
  const target = normalizeColor(color);
  let replaced = 0;
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attr of COLOR_ATTRS) {
      const value = el.getAttribute(attr);
      if (value && isColorValue(value) && normalizeColor(value) === target) {
        el.setAttribute(attr, 'currentColor');
        replaced += 1;
      }
    }
    const entries = styleEntries(el);
    if (entries.length === 0) continue;
    let touched = false;
    const rewritten = entries.map(([prop, value]): [string, string] => {
      if (
        STYLE_COLOR_PROPS.includes(prop) &&
        isColorValue(value) &&
        normalizeColor(value) === target
      ) {
        touched = true;
        replaced += 1;
        return [prop, 'currentColor'];
      }
      return [prop, value];
    });
    if (touched) {
      el.setAttribute('style', rewritten.map(([prop, value]) => `${prop}:${value}`).join(';'));
    }
  }
  return replaced;
}
