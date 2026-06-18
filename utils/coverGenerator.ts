/**
 * Programmatically composes a flat-design, A4-proportioned Korean e-book cover
 * (느낌: 첨부된 샘플 표지들 — 굵은 한글 타이포 + 강조 키워드 + 일러스트 영역 + 하단 컬러 밴드 설명).
 *
 * 결과 캔버스는 A4 비율(1:√2)로 생성되어 PDF에서 1페이지에 "딱 맞게" 들어갑니다.
 */

// A4 ratio canvas (150dpi 기준). width/height = 0.707 (A4 세로형)
const CANVAS_W = 1240;
const CANVAS_H = 1754;

interface CoverOptions {
  subtitle?: string;    // 상단 작은 부제 (예: 핵심 메시지)
  description?: string; // 하단 밴드 설명 (예: 주제 설명)
  themeKey?: string;    // 표지 무드/컬러 ('auto' 또는 아래 키 중 하나)
}

export interface Theme {
  key: string;
  label: string;  // UI 표시용 라벨
  swatch: string; // UI 색상 미리보기 (= band)
  top: string;    // 상단(라이트) 영역 배경
  band: string;   // 하단 비비드 밴드
  accent: string; // 강조 키워드/포인트 색
  title: string;  // 라이트 영역 위 제목 색
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

const pickTheme = (seed: string, themeKey?: string): Theme => {
  if (themeKey && themeKey !== 'auto') {
    const found = COVER_THEMES.find((t) => t.key === themeKey);
    if (found) return found;
  }
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  return COVER_THEMES[sum % COVER_THEMES.length];
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

export const overlayTextOnCover = async (
  base64Image: string,
  title: string,
  author: string,
  options: CoverOptions = {}
): Promise<string> => {
  // 한글 폰트가 적용된 상태에서 그리도록 폰트 로딩 대기
  try {
    if ((document as any).fonts && (document as any).fonts.ready) {
      await (document as any).fonts.ready;
    }
  } catch { /* ignore */ }

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const W = CANVAS_W;
  const H = CANVAS_H;
  const theme = pickTheme(title || 'innovation', options.themeKey);

  // --- 1. 배경: 상단 라이트존 + 하단 비비드 밴드 ---
  const bandTop = H * 0.60; // 하단 밴드 시작 지점

  ctx.fillStyle = theme.top;
  ctx.fillRect(0, 0, W, bandTop);

  ctx.fillStyle = theme.band;
  ctx.fillRect(0, bandTop, W, H - bandTop);

  // 라이트존 장식용 기하 도형 (은은하게)
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

  // 상단 컬러 액센트 바
  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, 0, W, H * 0.014);

  const KR = `'Noto Sans KR', 'Malgun Gothic', sans-serif`;
  const padX = W * 0.08;
  const contentW = W - padX * 2;

  // --- 2. 상단 부제 (작은 캡션, 한 줄 자동 맞춤) ---
  const subtitleRaw = (options.subtitle || '한번 읽으면 평생 써먹는 핵심 가이드').trim();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const subFit = fitSingleLine(ctx, subtitleRaw, contentW, '700', KR, Math.round(W * 0.030), Math.round(W * 0.020));
  ctx.fillStyle = theme.accent;
  ctx.font = `700 ${subFit.size}px ${KR}`;
  ctx.fillText(subFit.text, padX, H * 0.105);

  // 부제 밑 구분선
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(padX, H * 0.120);
  ctx.lineTo(padX + W * 0.14, H * 0.120);
  ctx.stroke();

  // --- 3. 메인 제목 (굵은 한글, 폭/줄수 자동 맞춤 → 잘림 없음, 마지막 줄 강조색) ---
  let titleStart = Math.round(W * 0.105);
  if (title.length > 22) titleStart = Math.round(W * 0.072);
  else if (title.length > 14) titleStart = Math.round(W * 0.085);
  else if (title.length > 8) titleStart = Math.round(W * 0.096);

  const titleFit = fitMultiLine(ctx, title, contentW, 3, '900', KR, titleStart, Math.round(W * 0.050));
  const titleSize = titleFit.size;
  const titleLines = titleFit.lines;
  const lineGap = titleSize * 1.20;
  const ty = H * 0.165;

  ctx.font = `900 ${titleSize}px ${KR}`;
  titleLines.forEach((line, idx) => {
    // 여러 줄일 때 마지막 줄(핵심 키워드)을 강조색으로
    const isAccent = titleLines.length > 1 && idx === titleLines.length - 1;
    ctx.fillStyle = isAccent ? theme.accent : theme.title;
    ctx.fillText(line, padX, ty + idx * lineGap);
  });
  const titleBottom = ty + (titleLines.length - 1) * lineGap;

  // --- 4. 일러스트 영역 (AI 이미지가 있으면 라운드 프레임에 cover-fit) ---
  const illTop = titleBottom + H * 0.04;
  const illBottom = bandTop - H * 0.035;
  const illH = illBottom - illTop;

  if (base64Image && base64Image.trim() !== '' && illH > 100) {
    try {
      const imgSrc = base64Image.startsWith('data:')
        ? base64Image
        : `data:image/png;base64,${base64Image}`;
      const img = await loadImage(imgSrc);

      const frameX = padX;
      const frameY = illTop;
      const frameW = contentW;
      const frameH = illH;

      ctx.save();
      drawRoundedRect(ctx, frameX, frameY, frameW, frameH, 28);
      ctx.clip();

      // cover-fit
      const scale = Math.max(frameW / img.naturalWidth, frameH / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const dx = frameX + (frameW - dw) / 2;
      const dy = frameY + (frameH - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
    } catch (e) {
      console.warn('Cover illustration draw failed, continuing without it.', e);
    }
  }

  // --- 5. 하단 비비드 밴드 콘텐츠 (모두 자동 맞춤 → 잘림 없음) ---
  ctx.textAlign = 'center';

  const description = (options.description || '').trim();
  const authorY = H - H * 0.052;
  const creditY = H - H * 0.026;

  // 헤드라인 / 본문 분리: 첫 문장이 짧으면 헤드라인 + 나머지는 본문, 길면 제목을 헤드라인으로
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

  let by = bandTop + H * 0.055; // 밴드 내부 커서

  // 헤드라인 (최대 2줄 자동 맞춤)
  const hl = fitMultiLine(ctx, headlineText, contentW, 2, '800', KR, Math.round(W * 0.044), Math.round(W * 0.028));
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 ${hl.size}px ${KR}`;
  const hlGap = hl.size * 1.2;
  hl.lines.forEach((line, i) => ctx.fillText(line, W / 2, by + i * hlGap));
  by += (hl.lines.length - 1) * hlGap + hl.size * 0.85;

  // 헤드라인 밑 구분선
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W * 0.43, by);
  ctx.lineTo(W * 0.57, by);
  ctx.stroke();
  by += H * 0.020;

  // 설명 본문 — 저자 영역 위 남는 공간에 맞춰 줄 수 제한, 넘치면 요약(…)
  if (descBodyText) {
    const descSize = Math.round(W * 0.026);
    const descGap = descSize * 1.5;
    const available = (authorY - H * 0.03) - by;
    const maxLines = Math.max(1, Math.min(4, Math.floor(available / descGap)));
    const dl = fitMultiLine(ctx, descBodyText, contentW, maxLines, '500', KR, descSize, Math.round(W * 0.020));
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `500 ${dl.size}px ${KR}`;
    const dGap = dl.size * 1.5;
    dl.lines.forEach((line, i) => ctx.fillText(line, W / 2, by + dl.size + i * dGap));
  }

  // 저자 (한 줄 자동 맞춤)
  const authorFit = fitSingleLine(ctx, `저자  ${author || '혁신 AI 저자'}`, contentW, '700', KR, Math.round(W * 0.030), Math.round(W * 0.022));
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `700 ${authorFit.size}px ${KR}`;
  ctx.fillText(authorFit.text, W / 2, authorY);

  // 출판 크레딧
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `600 ${Math.round(W * 0.020)}px 'Segoe UI', ${KR}`;
  ctx.fillText('INNOVATION AI E-BOOK', W / 2, creditY);

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
};
