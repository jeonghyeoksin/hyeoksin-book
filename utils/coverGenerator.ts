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
}

interface Theme {
  top: string;    // 상단(라이트) 영역 배경
  band: string;   // 하단 비비드 밴드
  accent: string; // 강조 키워드/포인트 색
  title: string;  // 라이트 영역 위 제목 색
}

// 샘플 표지에서 영감을 얻은 플랫 디자인 팔레트
const THEMES: Theme[] = [
  { top: '#FBF3D5', band: '#D72631', accent: '#D72631', title: '#1F2937' }, // 크림 + 레드 (프레젠테이션)
  { top: '#E9F8EF', band: '#1E9E54', accent: '#1E3A8A', title: '#14532D' }, // 민트 + 그린 (카피라이팅)
  { top: '#F1ECFA', band: '#4A2A8A', accent: '#7C3AED', title: '#2E1065' }, // 라벤더 + 퍼플 (시간관리)
  { top: '#E8F4FB', band: '#2D7DD2', accent: '#1B3A6B', title: '#0C4A6E' }, // 스카이 + 블루 (바다)
  { top: '#FDEDE8', band: '#EF5B3C', accent: '#EF5B3C', title: '#7C2D12' }, // 피치 + 코랄
  { top: '#FFF4E6', band: '#F2994A', accent: '#B45309', title: '#7C2D12' }, // 옐로우 + 오렌지
];

const pickTheme = (seed: string): Theme => {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  return THEMES[sum % THEMES.length];
};

// 한글/영문 혼용 제목을 폭에 맞춰 줄바꿈
const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
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
  const theme = pickTheme(title || 'innovation');

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

  const padX = W * 0.10;
  const contentW = W - padX * 2;

  // --- 2. 상단 부제 (작은 캡션) ---
  const subtitle = (options.subtitle || '한번 읽으면 평생 써먹는 핵심 가이드').trim();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = theme.accent;
  ctx.font = `700 ${Math.round(W * 0.030)}px 'Noto Sans KR', 'Malgun Gothic', sans-serif`;
  const subClipped = subtitle.length > 28 ? subtitle.slice(0, 28) + '…' : subtitle;
  ctx.fillText(subClipped, padX, H * 0.105);

  // 부제 밑 구분선
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(padX, H * 0.120);
  ctx.lineTo(padX + W * 0.14, H * 0.120);
  ctx.stroke();

  // --- 3. 메인 제목 (굵은 한글, 마지막 줄 강조색) ---
  let titleSize = Math.round(W * 0.105);
  if (title.length > 22) titleSize = Math.round(W * 0.066);
  else if (title.length > 14) titleSize = Math.round(W * 0.080);
  else if (title.length > 8) titleSize = Math.round(W * 0.094);

  ctx.font = `900 ${titleSize}px 'Noto Sans KR', 'Malgun Gothic', sans-serif`;
  const titleLines = wrapText(ctx, title, contentW);
  const lineGap = titleSize * 1.18;
  let ty = H * 0.20;

  titleLines.forEach((line, idx) => {
    // 마지막 줄(또는 단독 줄이 여러 단어일 때 핵심 키워드 줄)을 강조색으로
    const isAccent = titleLines.length > 1 ? idx === titleLines.length - 1 : false;
    ctx.fillStyle = isAccent ? theme.accent : theme.title;
    ctx.fillText(line, padX, ty + idx * lineGap);
  });
  const titleBottom = ty + (titleLines.length - 1) * lineGap;

  // --- 4. 일러스트 영역 (AI 이미지가 있으면 라운드 프레임에 cover-fit) ---
  const illTop = titleBottom + H * 0.045;
  const illBottom = bandTop - H * 0.04;
  const illH = illBottom - illTop;

  if (base64Image && base64Image.trim() !== '' && illH > 80) {
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

  // --- 5. 하단 비비드 밴드 콘텐츠 ---
  ctx.textAlign = 'center';

  // 헤드라인 (밴드 상단)
  const description = (options.description || '').trim();
  let headline = description.split(/[.!?。\n]/)[0].trim();
  if (!headline) headline = title;
  if (headline.length > 34) headline = headline.slice(0, 34) + '…';

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 ${Math.round(W * 0.042)}px 'Noto Sans KR', 'Malgun Gothic', sans-serif`;
  ctx.fillText(headline, W / 2, bandTop + H * 0.075);

  // 헤드라인 밑 구분선
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W * 0.42, bandTop + H * 0.095);
  ctx.lineTo(W * 0.58, bandTop + H * 0.095);
  ctx.stroke();

  // 설명 본문 (여러 줄)
  if (description) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `500 ${Math.round(W * 0.027)}px 'Noto Sans KR', 'Malgun Gothic', sans-serif`;
    const descLines = wrapText(ctx, description, contentW * 1.05).slice(0, 3);
    let dy2 = bandTop + H * 0.135;
    descLines.forEach((line) => {
      ctx.fillText(line, W / 2, dy2);
      dy2 += Math.round(W * 0.040);
    });
  }

  // 저자 + 출판 크레딧 (밴드 하단)
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `700 ${Math.round(W * 0.030)}px 'Noto Sans KR', 'Malgun Gothic', sans-serif`;
  ctx.fillText(`지은이  ${author || '혁신 AI 저자'}`, W / 2, H - H * 0.055);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `600 ${Math.round(W * 0.020)}px 'Segoe UI', 'Noto Sans KR', sans-serif`;
  ctx.fillText('INNOVATION AI E-BOOK', W / 2, H - H * 0.028);

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
};
