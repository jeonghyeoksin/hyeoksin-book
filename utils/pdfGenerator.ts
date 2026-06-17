import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { EBookState } from "../types";

const A4_W_MM = 210;
const A4_H_MM = 297;
const A4_RATIO = A4_H_MM / A4_W_MM; // 1.4142

const safeName = (title: string) => (title || 'ebook').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 80);

const coverDataUrl = (coverImage: string) =>
  coverImage.startsWith('data:') ? coverImage : `data:image/png;base64,${coverImage}`;

/**
 * 표지만 A4 1페이지에 "딱 맞게" 담아 PDF로 저장합니다.
 */
export const generateCoverPdf = async (ebook: EBookState): Promise<void> => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  if (ebook.coverImage) {
    // 표지 캔버스는 A4 비율로 생성되므로 페이지를 가득 채웁니다.
    pdf.addImage(coverDataUrl(ebook.coverImage), 'PNG', 0, 0, A4_W_MM, A4_H_MM);
  } else {
    pdf.setFontSize(24);
    pdf.text(ebook.title || '제목 없음', A4_W_MM / 2, A4_H_MM / 2, { align: 'center' });
  }

  pdf.save(`${safeName(ebook.title)}_표지.pdf`);
};

// 본문 색상 태그 -> HTML 변환 (마크다운 금지 규칙에 맞춤)
const formatContentForHtml = (text: string): string => {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  html = html.replace(/\[(RED|IMPORTANT)\](.*?)\[\/\1\]/g, '<span style="color:#dc2626;font-weight:700;">$2</span>');
  html = html.replace(/\[(BLUE|EMPHASIS)\](.*?)\[\/\1\]/g, '<span style="color:#2563eb;font-weight:700;">$2</span>');
  html = html.replace(/\[GREEN\](.*?)\[\/GREEN\]/g, '<span style="color:#16a34a;font-weight:700;">$1</span>');
  html = html.replace(/\[(YELLOW_BG|HIGHLIGHT)\](.*?)\[\/\1\]/g, '<span style="background-color:#fef08a;color:#111;font-weight:700;padding:0 2px;">$2</span>');

  return `<p>${html}</p>`;
};

const buildContentContainer = (ebook: EBookState): HTMLElement => {
  const currentYear = new Date().getFullYear();
  const container = document.createElement('div');
  // A4 폭(794px @96dpi)에 맞춘 가상 페이지. 화면 밖에 배치.
  container.style.cssText = [
    'position:fixed',
    'left:-99999px',
    'top:0',
    'width:794px',
    'background:#ffffff',
    "font-family:'Noto Sans KR','Malgun Gothic',sans-serif",
    'color:#1f2937',
    'box-sizing:border-box',
  ].join(';');

  const inner = document.createElement('div');
  inner.style.cssText = 'padding:64px 60px;';

  // 목차
  let html = '';
  html += `<h1 style="font-size:30px;font-weight:800;color:#0f172a;border-bottom:3px solid #4f46e5;padding-bottom:14px;margin:0 0 28px;">목차</h1>`;
  html += `<ol style="font-size:17px;line-height:2.0;padding-left:22px;margin:0 0 16px;color:#334155;">`;
  ebook.outline.forEach((ch) => { html += `<li style="margin-bottom:4px;font-weight:600;">${ch.replace(/</g, '&lt;')}</li>`; });
  html += `</ol>`;

  // 챕터 본문
  ebook.chapters.forEach((chapter, idx) => {
    html += `<div style="margin-top:48px;border-top:1px solid #e2e8f0;padding-top:28px;">`;
    html += `<h2 style="font-size:24px;font-weight:800;color:#312e81;margin:0 0 18px;">${idx + 1}. ${chapter.title.replace(/</g, '&lt;')}</h2>`;
    if (chapter.imageData) {
      const src = chapter.imageData.startsWith('data:') ? chapter.imageData : `data:image/png;base64,${chapter.imageData}`;
      html += `<div style="text-align:center;margin:0 0 22px;"><img src="${src}" style="max-width:100%;border-radius:10px;" /></div>`;
    }
    html += `<div style="font-size:16px;line-height:1.9;color:#1f2937;text-align:justify;">${formatContentForHtml(chapter.content || '')}</div>`;
    html += `</div>`;
  });

  // 저작권 / 면책 (마지막 부분)
  html += `<div style="margin-top:60px;border-top:2px solid #cbd5e1;padding-top:32px;color:#475569;">`;
  html += `<h2 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 16px;">저작권 및 면책 조항</h2>`;
  html += `<p style="font-size:14px;line-height:1.8;margin:0 0 10px;">ⓒ ${currentYear}. ${(ebook.author || '저자').replace(/</g, '&lt;')}. All rights reserved.</p>`;
  html += `<p style="font-size:14px;line-height:1.8;margin:0 0 10px;">본 전자책의 모든 내용에 대한 저작권은 저자에게 있습니다. 저작권자의 서면 동의 없는 무단 전재, 복제, 배포, 공중 송신을 엄격히 금지합니다.</p>`;
  html += `<p style="font-size:14px;line-height:1.8;margin:0;">본 저작물은 저작권법에 의해 보호받는 저작물이므로, 위반 시 관련 법령에 따라 민·형사상 책임을 질 수 있습니다.</p>`;
  html += `</div>`;

  inner.innerHTML = html;
  container.appendChild(inner);
  return container;
};

/**
 * 전체 전자책을 PDF로 저장합니다.
 * - 1페이지: 표지(A4에 딱 맞게)
 * - 이후: 목차 + 본문 + 마지막 저작권 문구
 * 한글이 깨지지 않도록 html2canvas로 렌더링한 뒤 A4 페이지 단위로 분할합니다.
 */
export const generateEbookPdf = async (ebook: EBookState): Promise<void> => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let isFirstPage = true;

  // --- 표지 (1페이지) ---
  if (ebook.coverImage) {
    pdf.addImage(coverDataUrl(ebook.coverImage), 'PNG', 0, 0, A4_W_MM, A4_H_MM);
    isFirstPage = false; // 본문은 다음 페이지부터
  }

  // --- 본문 렌더링 ---
  const container = buildContentContainer(ebook);
  document.body.appendChild(container);

  let fullCanvas: HTMLCanvasElement;
  try {
    fullCanvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });
  } finally {
    document.body.removeChild(container);
  }

  // A4 비율에 맞춰 페이지 높이(px) 계산 후 슬라이스
  const pageWidthPx = fullCanvas.width;
  const pageHeightPx = Math.floor(pageWidthPx * A4_RATIO);
  let renderedPx = 0;

  while (renderedPx < fullCanvas.height) {
    const sliceHeight = Math.min(pageHeightPx, fullCanvas.height - renderedPx);

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = pageWidthPx;
    pageCanvas.height = pageHeightPx;
    const pctx = pageCanvas.getContext('2d');
    if (!pctx) break;

    pctx.fillStyle = '#ffffff';
    pctx.fillRect(0, 0, pageWidthPx, pageHeightPx);
    pctx.drawImage(
      fullCanvas,
      0, renderedPx, pageWidthPx, sliceHeight,
      0, 0, pageWidthPx, sliceHeight
    );

    const imgData = pageCanvas.toDataURL('image/jpeg', 0.92);
    if (!isFirstPage) pdf.addPage();
    isFirstPage = false;
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, A4_H_MM);

    renderedPx += sliceHeight;
  }

  pdf.save(`${safeName(ebook.title)}.pdf`);
};
