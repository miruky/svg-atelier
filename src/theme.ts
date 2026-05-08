// 配色は「自動(OS追従)・ライト・ダーク」の3択。data-theme属性で切り替える。
// 初期化のちらつきを避けるため、index.html のインラインスクリプトが先に属性を当てる。
export type ThemeMode = 'auto' | 'light' | 'dark';

const THEME_KEY = 'svg-atelier.theme';
const ORDER: ThemeMode[] = ['auto', 'light', 'dark'];

export const THEME_LABEL: Record<ThemeMode, string> = {
  auto: '自動',
  light: 'ライト',
  dark: 'ダーク',
};

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark';
}

export function nextTheme(mode: ThemeMode): ThemeMode {
  return ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]!;
}

export function loadTheme(): ThemeMode {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (isThemeMode(value)) return value;
  } catch {
    // localStorage が使えない環境では自動扱いにする
  }
  return 'auto';
}

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // 保存できなくても表示には反映する
  }
}
