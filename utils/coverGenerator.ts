/**
 * Programmatically composes A4-proportioned Korean e-book covers in several distinct
 * layout styles (밴드형 / 풀블리드 / 미니멀 타이포 / 매거진형), each with a selectable
 * color theme. Optionally derives a custom color theme from a user-uploaded reference cover.
 *
 * 결과 캔버스는 A4 비율(1:√2)로 생성되어 PDF에서 1페이지에 "딱 맞게" 들어갑니다.
 */

// A4 ratio canvas (150dpi 기준). width/height = 0.707 (A4 세로형)
const CANVAS_W = 1240;
const CANVAS_H = 1754;

const FONT_KR = `'Noto Sans KR', 'Malgun Gothic', sans-serif`;

interface CoverOptions {
  subtitle?: string;      // 상단 작은 부제 (예: 핵심 메시지)
  description?: string;   // 하단/설명 영역 텍스트 (예: 주제 설명)
  themeKey?: string;      // 표지 무드/컬러 ('auto' 또는 아래 키 중 하나)
  layoutKey?: string;     // 표지 레이아웃 ('auto' 또는 COVER_LAYOUTS 중 하나)
  customTheme?: Theme;    // 참고 이미지에서 추출한 커스텀 컬러 테마 (있으면 themeKey보다 우선)
}

export interface Theme {
  key: string;
  label: string;  // UI 표시용 라벨
  swatch: string; // UI 색상 미리보기 (= band)
  top: string;    // 상단(라이트) 영역 배경
  band: string;   // 하단/포인트 비비드 컬러
  accent: string; // 강조 키워드/포인트 색
  title: string;  // 라이트 영역 위 제목 색
}

export interface Layout {
  key: string;
  label: string;
  description: string;
}

// 샘플 표지에서 영감을 얻은 플랫 디자인 팔레트 (사용자가 직접 선택 가능)
export const COVER_THEMES: Theme[] = [
  { key: 'red',    label: '레드 · 강렬',   swatch: '#D72631', top: '#FBF3D5', band: '#D72631', accent: '#D72631', title: '#1F2937' },
  { key: 'green',  label: '그린 · 실용',   swatch: '#1E9E54', top: '#E9F8EF', band: '#1E9E54', accent: '#1E3A8A', title: '#14532D' },
  { key: 'purple', label: '퍼플 · 프리미엄', swatch: '#4A2A8A', top: '#F1ECFA', band: '#4A2A8A', accent: '#7C3AED', title: '#2E1065' },
  { key: 'blue',   label: '블루 · 신뢰',   swatch: '#2D7DD2', top: '#E8F4FB', band: '#2D7DD2', accent: '#1B3A6B', title: '#0C4A6E' },
  { key: 'coral',  label: '코랄 · 감성',   swatch: '#EF5B3C', top: '#FDEDE8', band: '#EF5B3C', accent: '#EF5B3C', title: '#7C2D12' },
  { key: 'orange', label: '오렌지 · 활기', swatch: '#F2994A', top: '#FFF4E6', band: '#F2994A', accent: '#B45309', title: '#7C2D12' },
];

// 표지 레이아웃 템플릿 (사용자가 직접 선택 가능)
export const COVER_LAYOUTS: Layout[] = [
  { key: 'band',      label: '밴드형',        description: '상단 라이트존 + 하단 컬러 밴드 (기본)' },
  { key: 'fullbleed', label: '풀블리드',      description: 'AI 일러스트가 표지 전체를 채우는 스타일' },
  { key: 'minimal',   label: '미니멀 타이포', description: '이미지 없이 굵은 타이포 중심' },
  { key: 'magazine',  label: '매거진형',      description: '상단 이미지 + 하단 화이트 패널' },
];

const pickTheme = (seed: string, themeKey?: string): Theme => {
  if (themeKey && themeKey !== 'auto') {
    const found = COVER_THEMES.find((t) => t.key === themeKey);
    if (found) return found;
  }
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  return COVER_THEMES[sum % COVER_THEMES.length];
};

const pickLayout = (seed: string, layoutKey?: string): string => {
  if (layoutKey && layoutKey !== 'auto') {
    if (COVER_LAYOUTS.some((l) => l.key === layoutKey)) return layoutKey;
  }
  // 테마 선택과 다른 해시를 사용해, 같은 제목이라도 테마/레이아웃 조합이 매번 겹치지 않도록 합니다.
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i) * 7 + i;
  return COVER_LAYOUTS[sum % COVER_LAYOUTS.length].key;
};

// 폭에 맞춰 줄바꿈. 띄어쓰기 우선, 한 단어(한글 연속 토큰 등)가 폭을 넘으면 글자 단위로 강제 줄바꿈.
// → 가로 방향 잘림이 발생하지 않음.
const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const lines: string[] = [];
  const paragraphs = (text || '').split('\n');

  for (const para of paragraphs) {
    const words = para.split(' ').filter((w) => w.length > 0);
    let current = '';

    for (const word of words) {
      // 단어 자체가 폭을 넘으면 글자 단위로 분해
      if (ctx.measureText(word).width > maxWidth) {
        if (current) { lines.push(current); current = ''; }
        let chunk = '';
        for (const ch of word) {
          if (chunk && ctx.measureText(chunk + ch).width > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        current = chunk;
        continue;
      }

      const test = current ? current + ' ' + word : word;
      if (current && ctx.measureText(test).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }

  return lines;
};

// 한 줄 텍스트를 폭 안에 맞춤. 넘치면 폰트를 줄이고, 그래도 넘치면 말줄임(…)으로 요약.
const fitSingleLine = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  weight: string,
  family: string,
  startSize: number,
  minSize: number
): { text: string; size: number } => {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return { text, size };
    size -= 2;
  }
  ctx.font = `${weight} ${minSize}px ${family}`;
  if (ctx.measureText(text).width <= maxWidth) return { text, size: minSize };
  // 최소 폰트에서도 넘치면 말줄임
  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return { text: truncated + '…', size: minSize };
};

// 여러 줄 텍스트를 (폭 + 최대 줄 수) 안에 맞춤. 폰트를 줄여보고, 그래도 넘치면 마지막 줄을 말줄임 요약.
const fitMultiLine = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  weight: string,
  family: string,
  startSize: number,
  minSize: number
): { lines: string[]; size: number } => {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    const lines = wrapText(ctx, text, maxWidth);
    if (lines.length <= maxLines) return { lines, size };
    size -= 2;
  }
  ctx.font = `${weight} ${minSize}px ${family}`;
  let lines = wrapText(ctx, text, maxWidth);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = last + '…';
  }
  return { lines, size: minSize };
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const loadImageSafe = async (base64Image?: string): Promise<HTMLImageElement | null> => {
  if (!base64Image || base64Image.trim() === '') return null;
  try {
    const src = base64Image.startsWith('data:') ? base64Image : `data:image/png;base64,${base64Image}`;
    return await loadImage(src);
  } catch (e) {
    console.warn('Cover illustration load failed, continuing without it.', e);
    return null;
  }
};

const ensureFontsReady = async () => {
  try {
    if ((document as any).fonts && (document as any).fonts.ready) {
      await (document as any).fonts.ready;
    }
  } catch { /* ignore */ }
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// ---------------------------------------------------------------------------
// 레이아웃 A: 밴드형 (기존 스타일) — 상단 라이트존 + 제목 + 일러스트 프레임 + 하단 컬러 밴드
// ---------------------------------------------------------------------------
const drawBandLayout = (
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  theme: Theme,
  title: string,
  author: string,
  img: HTMLImageElement | null,
  options: CoverOptions
) => {
  const bandTop = H * 0.60;

  ctx.fillStyle = theme.top;
  ctx.fillRect(0, 0, W, bandTop);

  ctx.fillStyle = theme.band;
  ctx.fillRect(0, bandTop, W, H - bandTop);

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = theme.band;
  ctx.beginPath();
  ctx.arc(W * 0.88, H * 0.10, W * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.10, H * 0.42, W * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, 0, W, H * 0.014);

  const padX = W * 0.08;
  const contentW = W - padX * 2;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const subtitleRaw = (options.subtitle || '한번 읽으면 평생 써먹는 핵심 가이드').trim();
  const subFit = fitSingleLine(ctx, subtitleRaw, contentW, '700', FONT_KR, Math.round(W * 0.030), Math.round(W * 0.020));
  ctx.fillStyle = theme.accent;
  ctx.font = `700 ${subFit.size}px ${FONT_KR}`;
  ctx.fillText(subFit.text, padX, H * 0.105);

  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(padX, H * 0.120);
  ctx.lineTo(padX + W * 0.14, H * 0.120);
  ctx.stroke();

  let titleStart = Math.round(W * 0.105);
  if (title.length > 22) titleStart = Math.round(W * 0.072);
  else if (title.length > 14) titleStart = Math.round(W * 0.085);
  else if (title.length > 8) titleStart = Math.round(W * 0.096);

  const titleFit = fitMultiLine(ctx, title, contentW, 3, '900', FONT_KR, titleStart, Math.round(W * 0.050));
  const titleSize = titleFit.size;
  const titleLines = titleFit.lines;
  const lineGap = titleSize * 1.20;
  const ty = H * 0.165;

  ctx.font = `900 ${titleSize}px ${FONT_KR}`;
  titleLines.forEach((line, idx) => {
    const isAccent = titleLines.length > 1 && idx === titleLines.length - 1;
    ctx.fillStyle = isAccent ? theme.accent : theme.title;
    ctx.fillText(line, padX, ty + idx * lineGap);
  });
  const titleBottom = ty + (titleLines.length - 1) * lineGap;

  const illTop = titleBottom + H * 0.04;
  const illBottom = bandTop - H * 0.035;
  const illH = illBottom - illTop;

  if (img && illH > 100) {
    const frameX = padX;
    const frameY = illTop;
    const frameW = contentW;
    const frameH = illH;

    ctx.save();
    drawRoundedRect(ctx, frameX, frameY, frameW, frameH, 28);
    ctx.clip();

    const scale = Math.max(frameW / img.naturalWidth, frameH / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const dx = frameX + (frameW - dw) / 2;
    const dy = frameY + (frameH - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  ctx.textAlign = 'center';

  const description = (options.description || '').trim();
  const authorY = H - H * 0.052;
  const creditY = H - H * 0.026;

  let headlineText: string;
  let descBodyText: string;
  if (description) {
    const parts = description.split(/(?<=[.!?。])\s+/);
    const first = (parts[0] || '').trim();
    if (first && first.length <= 42) {
      headlineText = first;
      descBodyText = parts.slice(1).join(' ').trim();
    } else {
      headlineText = title;
      descBodyText = description;
    }
  } else {
    headlineText = title;
    descBodyText = '';
  }

  let by = bandTop + H * 0.055;

  const hl = fitMultiLine(ctx, headlineText, contentW, 2, '800', FONT_KR, Math.round(W * 0.044), Math.round(W * 0.028));
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 ${hl.size}px ${FONT_KR}`;
  const hlGap = hl.size * 1.2;
  hl.lines.forEach((line, i) => ctx.fillText(line, W / 2, by + i * hlGap));
  by += (hl.lines.length - 1) * hlGap + hl.size * 0.85;

  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W * 0.43, by);
  ctx.lineTo(W * 0.57, by);
  ctx.stroke();
  by += H * 0.020;

  if (descBodyText) {
    const descSize = Math.round(W * 0.026);
    const descGap = descSize * 1.5;
    const available = (authorY - H * 0.03) - by;
    const maxLines = Math.max(1, Math.min(4, Math.floor(available / descGap)));
    const dl = fitMultiLine(ctx, descBodyText, contentW, maxLines, '500', FONT_KR, descSize, Math.round(W * 0.020));
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `500 ${dl.size}px ${FONT_KR}`;
    const dGap = dl.size * 1.5;
    dl.lines.forEach((line, i) => ctx.fillText(line, W / 2, by + dl.size + i * dGap));
  }

  const authorFit = fitSingleLine(ctx, `저자  ${author || '혁신 AI 저자'}`, contentW, '700', FONT_KR, Math.round(W * 0.030), Math.round(W * 0.022));
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `700 ${authorFit.size}px ${FONT_KR}`;
  ctx.fillText(authorFit.text, W / 2, authorY);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `600 ${Math.round(W * 0.020)}px 'Segoe UI', ${FONT_KR}`;
  ctx.fillText('INNOVATION AI E-BOOK', W / 2, creditY);
};

// ---------------------------------------------------------------------------
// 레이아웃 B: 풀블리드 — AI 일러스트가 표지 전체를 채우고, 하단 그라디언트 위에 타이포
// ---------------------------------------------------------------------------
const drawFullBleedLayout = (
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  theme: Theme,
  title: string,
  author: string,
  img: HTMLImageElement | null,
  options: CoverOptions
) => {
  if (img) {
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, theme.top);
    grad.addColorStop(1, theme.band);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  const topScrim = ctx.createLinearGradient(0, 0, 0, H * 0.18);
  topScrim.addColorStop(0, 'rgba(0,0,0,0.45)');
  topScrim.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topScrim;
  ctx.fillRect(0, 0, W, H * 0.18);

  const bottomScrim = ctx.createLinearGradient(0, H * 0.42, 0, H);
  bottomScrim.addColorStop(0, 'rgba(0,0,0,0)');
  bottomScrim.addColorStop(0.55, 'rgba(0,0,0,0.60)');
  bottomScrim.addColorStop(1, 'rgba(0,0,0,0.88)');
  ctx.fillStyle = bottomScrim;
  ctx.fillRect(0, H * 0.42, W, H - H * 0.42);

  const padX = W * 0.08;
  const contentW = W - padX * 2;

  ctx.textAlign = 'left';
  const subtitleRaw = (options.subtitle || '한번 읽으면 평생 써먹는 핵심 가이드').trim();
  const subFit = fitSingleLine(ctx, subtitleRaw, contentW, '700', FONT_KR, Math.round(W * 0.028), Math.round(W * 0.019));
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${subFit.size}px ${FONT_KR}`;
  ctx.fillText(subFit.text, padX, H * 0.10);

  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(padX, H * 0.116);
  ctx.lineTo(padX + W * 0.14, H * 0.116);
  ctx.stroke();

  const titleFit = fitMultiLine(ctx, title, contentW, 3, '900', FONT_KR, Math.round(W * 0.090), Math.round(W * 0.048));
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 ${titleFit.size}px ${FONT_KR}`;
  const lineGap = titleFit.size * 1.18;
  const titleBottom = H * 0.855;
  const titleTop = titleBottom - (titleFit.lines.length - 1) * lineGap;
  titleFit.lines.forEach((line, i) => ctx.fillText(line, padX, titleTop + i * lineGap));

  const description = (options.description || '').trim();
  if (description) {
    const descSize = Math.round(W * 0.024);
    const dl = fitMultiLine(ctx, description, contentW, 2, '500', FONT_KR, descSize, Math.round(W * 0.018));
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `500 ${dl.size}px ${FONT_KR}`;
    const dGap = dl.size * 1.45;
    dl.lines.forEach((line, i) => ctx.fillText(line, padX, titleBottom + H * 0.045 + i * dGap));
  }

  const authorFit = fitSingleLine(ctx, `저자  ${author || '혁신 AI 저자'}`, contentW, '700', FONT_KR, Math.round(W * 0.026), Math.round(W * 0.019));
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${authorFit.size}px ${FONT_KR}`;
  ctx.fillText(authorFit.text, padX, H - H * 0.045);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `600 ${Math.round(W * 0.017)}px 'Segoe UI', ${FONT_KR}`;
  ctx.fillText('INNOVATION AI E-BOOK', padX, H - H * 0.022);
};

// ---------------------------------------------------------------------------
// 레이아웃 C: 미니멀 타이포 — 이미지 없이(또는 작은 배지로) 굵은 타이포 중심
// ---------------------------------------------------------------------------
const drawMinimalLayout = (
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  theme: Theme,
  title: string,
  author: string,
  img: HTMLImageElement | null,
  options: CoverOptions
) => {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, theme.band);
  grad.addColorStop(1, theme.accent);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  for (let x = -H; x < W; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + H, H);
    ctx.stroke();
  }
  ctx.restore();

  const padX = W * 0.10;
  const contentW = W - padX * 2;

  let titleTop = H * 0.42;

  if (img) {
    const badgeSize = W * 0.40;
    const bx = (W - badgeSize) / 2;
    const by = H * 0.10;
    ctx.save();
    ctx.beginPath();
    ctx.arc(bx + badgeSize / 2, by + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
    ctx.clip();
    const scale = Math.max(badgeSize / img.naturalWidth, badgeSize / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, bx + (badgeSize - dw) / 2, by + (badgeSize - dh) / 2, dw, dh);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(bx + badgeSize / 2, by + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    titleTop = by + badgeSize + H * 0.10;
  }

  ctx.textAlign = 'center';

  // 제목 크기를 먼저 계산해, 제목 어센트(글자 상단)를 침범하지 않는 위치에 부제를 그립니다.
  const titleFit = fitMultiLine(ctx, title, contentW, 4, '900', FONT_KR, Math.round(W * 0.075), Math.round(W * 0.042));

  const subtitleRaw = (options.subtitle || '').trim();
  if (subtitleRaw) {
    const subFit = fitSingleLine(ctx, subtitleRaw, contentW, '700', FONT_KR, Math.round(W * 0.026), Math.round(W * 0.018));
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `700 ${subFit.size}px ${FONT_KR}`;
    // 제목 폰트의 어센트(약 0.85배) + 부제 자신의 높이 + 여백만큼 제목 위에 띄웁니다.
    ctx.fillText(subFit.text, W / 2, titleTop - titleFit.size * 0.85 - subFit.size * 1.3);
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 ${titleFit.size}px ${FONT_KR}`;
  const lineGap = titleFit.size * 1.22;
  titleFit.lines.forEach((line, i) => ctx.fillText(line, W / 2, titleTop + i * lineGap));
  const titleBottom = titleTop + (titleFit.lines.length - 1) * lineGap;

  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - W * 0.06, titleBottom + H * 0.03);
  ctx.lineTo(W / 2 + W * 0.06, titleBottom + H * 0.03);
  ctx.stroke();

  const description = (options.description || '').trim();
  if (description) {
    const dl = fitMultiLine(ctx, description, contentW, 3, '500', FONT_KR, Math.round(W * 0.024), Math.round(W * 0.018));
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `500 ${dl.size}px ${FONT_KR}`;
    const dGap = dl.size * 1.5;
    const dTop = titleBottom + H * 0.07;
    dl.lines.forEach((line, i) => ctx.fillText(line, W / 2, dTop + i * dGap));
  }

  const authorFit = fitSingleLine(ctx, `저자  ${author || '혁신 AI 저자'}`, contentW, '700', FONT_KR, Math.round(W * 0.028), Math.round(W * 0.020));
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `700 ${authorFit.size}px ${FONT_KR}`;
  ctx.fillText(authorFit.text, W / 2, H - H * 0.06);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `600 ${Math.round(W * 0.018)}px 'Segoe UI', ${FONT_KR}`;
  ctx.fillText('INNOVATION AI E-BOOK', W / 2, H - H * 0.03);
};

// ---------------------------------------------------------------------------
// 레이아웃 D: 매거진형 — 상단 2/3 이미지 + 하단 1/3 화이트 패널
// ---------------------------------------------------------------------------
const drawMagazineLayout = (
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  theme: Theme,
  title: string,
  author: string,
  img: HTMLImageElement | null,
  options: CoverOptions
) => {
  const imageBottom = H * 0.60;

  ctx.fillStyle = theme.top;
  ctx.fillRect(0, 0, W, imageBottom);

  if (img) {
    const scale = Math.max(W / img.naturalWidth, imageBottom / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, imageBottom);
    ctx.clip();
    ctx.drawImage(img, (W - dw) / 2, (imageBottom - dh) / 2, dw, dh);
    ctx.restore();
  }

  const padX = W * 0.08;
  const contentW = W - padX * 2;

  const subtitleRaw = (options.subtitle || '').trim();
  if (subtitleRaw) {
    ctx.textAlign = 'left';
    const subFit = fitSingleLine(ctx, subtitleRaw, contentW * 0.8, '800', FONT_KR, Math.round(W * 0.024), Math.round(W * 0.017));
    ctx.font = `800 ${subFit.size}px ${FONT_KR}`;
    const tw = ctx.measureText(subFit.text).width;
    const tagPadX = W * 0.02;
    const tagPadY = H * 0.010;
    const tagY = H * 0.045;
    ctx.fillStyle = theme.accent;
    drawRoundedRect(ctx, padX, tagY, tw + tagPadX * 2, subFit.size + tagPadY * 2, 8);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(subFit.text, padX + tagPadX, tagY + subFit.size + tagPadY * 0.15);
  }

  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, imageBottom - H * 0.006, W, H * 0.006);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, imageBottom, W, H - imageBottom);

  ctx.textAlign = 'left';
  let titleStart = Math.round(W * 0.062);
  if (title.length > 22) titleStart = Math.round(W * 0.046);
  else if (title.length > 14) titleStart = Math.round(W * 0.052);

  const titleFit = fitMultiLine(ctx, title, contentW, 3, '900', FONT_KR, titleStart, Math.round(W * 0.036));
  ctx.fillStyle = theme.title;
  ctx.font = `900 ${titleFit.size}px ${FONT_KR}`;
  const lineGap = titleFit.size * 1.18;
  const ty = imageBottom + H * 0.075;
  titleFit.lines.forEach((line, i) => ctx.fillText(line, padX, ty + i * lineGap));
  const titleBottom = ty + (titleFit.lines.length - 1) * lineGap;

  const description = (options.description || '').trim();
  if (description) {
    const available = (H - H * 0.09) - (titleBottom + H * 0.03);
    const descSize = Math.round(W * 0.023);
    const descGap = descSize * 1.5;
    const maxLines = Math.max(1, Math.min(3, Math.floor(available / descGap)));
    const dl = fitMultiLine(ctx, description, contentW, maxLines, '500', FONT_KR, descSize, Math.round(W * 0.018));
    ctx.fillStyle = '#475569';
    ctx.font = `500 ${dl.size}px ${FONT_KR}`;
    const dGap = dl.size * 1.5;
    const dTop = titleBottom + H * 0.045;
    dl.lines.forEach((line, i) => ctx.fillText(line, padX, dTop + i * dGap));
  }

  ctx.fillStyle = theme.accent;
  const authorFit = fitSingleLine(ctx, `저자  ${author || '혁신 AI 저자'}`, contentW, '700', FONT_KR, Math.round(W * 0.026), Math.round(W * 0.019));
  ctx.font = `700 ${authorFit.size}px ${FONT_KR}`;
  ctx.fillText(authorFit.text, padX, H - H * 0.05);

  ctx.fillStyle = '#94A3B8';
  ctx.font = `600 ${Math.round(W * 0.017)}px 'Segoe UI', ${FONT_KR}`;
  ctx.fillText('INNOVATION AI E-BOOK', padX, H - H * 0.025);
};

export const overlayTextOnCover = async (
  base64Image: string,
  title: string,
  author: string,
  options: CoverOptions = {}
): Promise<string> => {
  // 한글 폰트가 적용된 상태에서 그리도록 폰트 로딩 대기
  await ensureFontsReady();

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const theme = options.customTheme || pickTheme(title || 'innovation', options.themeKey);
  const layout = pickLayout(title || 'innovation', options.layoutKey);
  const img = await loadImageSafe(base64Image);

  ctx.textBaseline = 'alphabetic';

  switch (layout) {
    case 'fullbleed':
      drawFullBleedLayout(ctx, CANVAS_W, CANVAS_H, theme, title, author, img, options);
      break;
    case 'minimal':
      drawMinimalLayout(ctx, CANVAS_W, CANVAS_H, theme, title, author, img, options);
      break;
    case 'magazine':
      drawMagazineLayout(ctx, CANVAS_W, CANVAS_H, theme, title, author, img, options);
      break;
    case 'band':
    default:
      drawBandLayout(ctx, CANVAS_W, CANVAS_H, theme, title, author, img, options);
      break;
  }

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
};

// ---------------------------------------------------------------------------
// 참고 표지 이미지에서 색상 테마를 추출 ("유사한 표지 스타일" 기능)
// ---------------------------------------------------------------------------
const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
};

const hslToHex = (h: number, s: number, l: number): string => {
  s = Math.min(1, Math.max(0, s));
  l = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * 업로드된 참고 표지 이미지의 가장 도드라진(채도 높은) 색상을 기준으로
 * top/band/accent/title 팔레트를 구성한 커스텀 Theme을 만듭니다.
 */
export const extractThemeFromImage = async (base64Image: string): Promise<Theme> => {
  const img = await loadImageSafe(base64Image);
  if (!img) return COVER_THEMES[0];

  const canvas = document.createElement('canvas');
  const w = 60, h = 60;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return COVER_THEMES[0];
  ctx.drawImage(img, 0, 0, w, h);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch (e) {
    // getImageData가 캔버스 보안 정책(CORS)으로 실패할 수 있음 → 기본 테마로 폴백
    console.warn('Failed to read reference image pixels for theme extraction.', e);
    return COVER_THEMES[0];
  }

  let maxSat = -1, domH = 220, domS = 0.5, domL = 0.45;
  let sampleCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 200) continue;
    sampleCount++;
    const [hue, sat, l] = rgbToHsl(r, g, b);
    if (sat > maxSat && l > 0.15 && l < 0.85) {
      maxSat = sat;
      domH = hue;
      domS = sat;
      domL = l;
    }
  }
  if (sampleCount === 0) return COVER_THEMES[0];

  return {
    key: 'reference',
    label: '참고 이미지 · 커스텀',
    swatch: hslToHex(domH, Math.max(0.45, domS), Math.min(0.5, Math.max(0.38, domL))),
    top: hslToHex(domH, Math.min(0.35, domS * 0.4), 0.95),
    band: hslToHex(domH, Math.max(0.45, domS), Math.min(0.5, Math.max(0.38, domL))),
    accent: hslToHex(domH, Math.min(1, domS + 0.1), Math.max(0.28, domL - 0.12)),
    title: hslToHex(domH, Math.min(0.5, domS * 0.6), 0.18),
  };
};
