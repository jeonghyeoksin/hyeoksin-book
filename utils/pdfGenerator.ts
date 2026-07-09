import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Chapter, EBookState } from "../types";
import { splitIntoParagraphs } from "./textFormat";

const A4_W_MM = 210;
const A4_H_MM = 297;
const A4_RATIO = A4_H_MM / A4_W_MM; // 1.4142
const PAGE_PX_WIDTH = 794; // A4 폭(96dpi 기준 가상 페이지)
const CSS_PAGE_HEIGHT = Math.round(PAGE_PX_WIDTH * A4_RATIO); // A4 한 페이지 높이(96dpi CSS px 기준)
// 섹션(챕터) 하나가 지나치게 길면(예: 매우 긴 챕터) html2canvas가 만드는 캔버스가
// 브라우저의 캔버스 크기 한계를 넘어 렌더링이 조용히 실패할 수 있습니다.
// 이를 막기 위해 한 번에 렌더링할 섹션의 최대 높이를 페이지 16장 분량으로 제한합니다.
const MAX_SECTION_CSS_HEIGHT = CSS_PAGE_HEIGHT * 16;

const safeName = (title: string) => (title || 'ebook').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 80);

const coverDataUrl = (coverImage: string) =>
  coverImage.startsWith('data:') ? coverImage : `data:image/png;base64,${coverImage}`;

/**
 * 표지만 A4 1페이지에 "딱 맞게" 담아 PDF로 저장합니다.
 */
export const generateCoverPdf = async (ebook: EBookState): Promise<void> => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  if (ebook.coverImage) {
    pdf.addImage(coverDataUrl(ebook.coverImage), 'PNG', 0, 0, A4_W_MM, A4_H_MM);
  } else {
    pdf.setFontSize(24);
    pdf.text(ebook.title || '제목 없음', A4_W_MM / 2, A4_H_MM / 2, { align: 'center' });
  }

  pdf.save(`${safeName(ebook.title)}_표지.pdf`);
};

// 한 문단의 인라인 서식(색상 태그) 처리
const inlineFormat = (text: string): string => {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/\[(RED|IMPORTANT)\](.*?)\[\/\1\]/g, '<span style="color:#dc2626;font-weight:700;">$2</span>');
  html = html.replace(/\[(BLUE|EMPHASIS)\](.*?)\[\/\1\]/g, '<span style="color:#2563eb;font-weight:700;">$2</span>');
  html = html.replace(/\[GREEN\](.*?)\[\/GREEN\]/g, '<span style="color:#16a34a;font-weight:700;">$1</span>');
  html = html.replace(/\[(YELLOW_BG|HIGHLIGHT)\](.*?)\[\/\1\]/g, '<span style="background-color:#fef08a;color:#111;font-weight:700;padding:0 2px;">$2</span>');

  return html;
};

// 본문을 가독성 좋은 문단(<p>)들로 변환. 각 <p>가 페이지 분할 시 "잘리면 안 되는 최소 단위"가 됩니다.
const formatContentForHtml = (text: string): string =>
  splitIntoParagraphs(text)
    .map((p) => `<p style="margin:0 0 15px;font-size:16px;line-height:1.9;color:#1f2937;text-align:justify;">${inlineFormat(p)}</p>`)
    .join('');

const buildTocHtml = (ebook: EBookState): string => {
  let html = `<h1 style="font-size:30px;font-weight:800;color:#0f172a;border-bottom:3px solid #4f46e5;padding-bottom:14px;margin:0 0 28px;">목차</h1>`;
  html += `<ol style="font-size:17px;line-height:2.0;padding-left:22px;margin:0 0 16px;color:#334155;">`;
  ebook.outline.forEach((ch) => { html += `<li style="margin-bottom:4px;font-weight:600;">${ch.replace(/</g, '&lt;')}</li>`; });
  html += `</ol>`;
  return html;
};

const buildChapterHtml = (chapter: Chapter, idx: number): string => {
  let html = `<h2 style="font-size:24px;font-weight:800;color:#312e81;margin:0 0 18px;">${idx + 1}. ${chapter.title.replace(/</g, '&lt;')}</h2>`;
  if (chapter.imageData) {
    const src = chapter.imageData.startsWith('data:') ? chapter.imageData : `data:image/png;base64,${chapter.imageData}`;
    html += `<div style="text-align:center;margin:0 0 22px;"><img src="${src}" style="max-width:100%;border-radius:10px;" /></div>`;
  }
  html += formatContentForHtml(chapter.content || '');
  return html;
};

const buildCopyrightHtml = (ebook: EBookState): string => {
  const currentYear = new Date().getFullYear();
  let html = `<h2 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 16px;">저작권 및 면책 조항</h2>`;
  html += `<p style="font-size:14px;line-height:1.8;margin:0 0 10px;color:#475569;">ⓒ ${currentYear}. ${(ebook.author || '저자').replace(/</g, '&lt;')}. All rights reserved.</p>`;
  html += `<p style="font-size:14px;line-height:1.8;margin:0 0 10px;color:#475569;">본 전자책의 모든 내용에 대한 저작권은 저자에게 있습니다. 저작권자의 서면 동의 없는 무단 전재, 복제, 배포, 공중 송신을 엄격히 금지합니다.</p>`;
  html += `<p style="font-size:14px;line-height:1.8;margin:0;color:#475569;">본 저작물은 저작권법에 의해 보호받는 저작물이므로, 위반 시 관련 법령에 따라 민·형사상 책임을 질 수 있습니다.</p>`;
  return html;
};

/**
 * 목차 / 챕터별 / 저작권을 "각각 독립된 섹션"으로 나눕니다.
 * (책 전체를 하나의 거대한 캔버스로 렌더링하면 브라우저 캔버스 크기 한계를 넘어
 *  아무 에러 없이 빈 화면이 렌더링되는 문제가 있어, 섹션 단위로 쪼갭니다.)
 */
const buildContentSections = (ebook: EBookState): string[] => {
  const sections: string[] = [buildTocHtml(ebook)];
  ebook.chapters.forEach((chapter, idx) => sections.push(buildChapterHtml(chapter, idx)));
  sections.push(buildCopyrightHtml(ebook));
  return sections;
};

// 렌더링 결과가 완전한 백지인지 검사 (썸네일로 축소 후 픽셀 샘플링, 대용량 캔버스에서도 빠름)
const isCanvasBlank = (canvas: HTMLCanvasElement): boolean => {
  const sample = document.createElement('canvas');
  const sw = 48;
  const sh = Math.max(1, Math.round(sw * (canvas.height / canvas.width)));
  sample.width = sw;
  sample.height = sh;
  const sctx = sample.getContext('2d');
  if (!sctx) return false;
  sctx.drawImage(canvas, 0, 0, sw, sh);
  const { data } = sctx.getImageData(0, 0, sw, sh);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) return false;
  }
  return true;
};

interface SectionRender {
  canvas: HTMLCanvasElement;
  // 각 최상위 블록(문단/제목/이미지)의 바닥 y좌표(캔버스 px 기준). 페이지 분할 시 이 경계에서 끊습니다.
  breakpoints: number[];
}

const renderHtmlToCanvas = async (html: string, scale: number): Promise<SectionRender> => {
  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed',
    'top:0',
    'left:-99999px',
    `width:${PAGE_PX_WIDTH}px`,
    'background:#ffffff',
    "font-family:'Noto Sans KR','Malgun Gothic',sans-serif",
    'color:#1f2937',
    'box-sizing:border-box',
  ].join(';');

  const inner = document.createElement('div');
  inner.style.cssText = 'padding:64px 60px;';
  inner.innerHTML = html;
  container.appendChild(inner);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: PAGE_PX_WIDTH,
    });

    const breakpoints = Array.from(inner.children).map((el) => {
      const elh = el as HTMLElement;
      return Math.round((elh.offsetTop + elh.offsetHeight) * scale);
    });

    return { canvas, breakpoints };
  } finally {
    document.body.removeChild(container);
  }
};

// 섹션 HTML의 최상위 블록(문단/제목 등)들을 실제 DOM에 넣어 높이를 측정한 뒤,
// MAX_SECTION_CSS_HEIGHT를 넘지 않는 하위 청크들로 나눕니다.
// (챕터 하나가 지나치게 길어 캔버스 크기 한계에 걸리는 것을 사전에 방지)
const splitHtmlByHeight = (html: string, maxHeightPx: number): string[] => {
  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed',
    'top:0',
    'left:-99999px',
    `width:${PAGE_PX_WIDTH}px`,
    'box-sizing:border-box',
  ].join(';');
  const inner = document.createElement('div');
  inner.style.cssText = 'padding:64px 60px;';
  inner.innerHTML = html;
  container.appendChild(inner);
  document.body.appendChild(container);

  const children = Array.from(inner.children) as HTMLElement[];
  if (children.length === 0) {
    document.body.removeChild(container);
    return [html];
  }

  const chunks: string[] = [];
  let chunkHtml = '';
  let chunkStart = children[0].offsetTop;

  children.forEach((el) => {
    const bottom = el.offsetTop + el.offsetHeight;
    if (chunkHtml && bottom - chunkStart > maxHeightPx) {
      chunks.push(chunkHtml);
      chunkHtml = '';
      chunkStart = el.offsetTop;
    }
    chunkHtml += el.outerHTML;
  });
  if (chunkHtml) chunks.push(chunkHtml);

  document.body.removeChild(container);
  return chunks;
};

// 백지 렌더링 감지 시 scale을 낮춰 1회 재시도. 그래도 실패하면 명확한 에러를 던집니다.
const renderSectionCanvas = async (html: string): Promise<SectionRender> => {
  for (const scale of [2, 1]) {
    const result = await renderHtmlToCanvas(html, scale);
    if (!isCanvasBlank(result.canvas)) return result;
  }
  throw new Error('PDF 콘텐츠 렌더링에 실패했습니다. 브라우저를 새로고침한 뒤 다시 시도해 주세요.');
};

// 이상적인 절단 지점(idealEnd) 이하에서 가장 가까운 블록 경계를 찾아, 문단/제목이 중간에 잘리지 않게 합니다.
const pickSliceEnd = (renderedPx: number, idealEnd: number, canvasHeight: number, breakpoints: number[]): number => {
  if (idealEnd >= canvasHeight) return canvasHeight;
  let best = -1;
  for (const bp of breakpoints) {
    if (bp > renderedPx && bp <= idealEnd) best = Math.max(best, bp);
  }
  return best > renderedPx ? best : idealEnd;
};

// 캔버스를 A4 페이지 단위로 슬라이스하여 PDF에 순서대로 추가합니다.
const addCanvasPages = (pdf: jsPDF, section: SectionRender, isFirstPage: boolean): boolean => {
  const { canvas, breakpoints } = section;
  const pageWidthPx = canvas.width;
  const pageHeightPx = Math.floor(pageWidthPx * A4_RATIO);
  // 컨테이너 하단 padding만큼의 순수 여백은 별도 페이지로 만들지 않고 버립니다.
  // (그렇지 않으면 마지막 문단 breakpoint 이후의 padding-bottom 영역만으로
  //  거의 백지에 가까운 페이지가 섹션마다 하나씩 추가로 생성됩니다.)
  const contentHeight = breakpoints.length > 0 ? breakpoints[breakpoints.length - 1] : canvas.height;
  let renderedPx = 0;
  let firstPage = isFirstPage;

  while (renderedPx < contentHeight) {
    const idealEnd = Math.min(renderedPx + pageHeightPx, contentHeight);
    const sliceEnd = pickSliceEnd(renderedPx, idealEnd, contentHeight, breakpoints);
    const sliceHeight = sliceEnd - renderedPx;
    if (sliceHeight <= 0) break;

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = pageWidthPx;
    pageCanvas.height = pageHeightPx;
    const pctx = pageCanvas.getContext('2d');
    if (!pctx) break;

    pctx.fillStyle = '#ffffff';
    pctx.fillRect(0, 0, pageWidthPx, pageHeightPx);
    pctx.drawImage(
      canvas,
      0, renderedPx, pageWidthPx, sliceHeight,
      0, 0, pageWidthPx, sliceHeight
    );

    const imgData = pageCanvas.toDataURL('image/jpeg', 0.92);
    if (!firstPage) pdf.addPage();
    firstPage = false;
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, A4_H_MM);

    renderedPx = sliceEnd;
  }

  return firstPage;
};

/**
 * 전체 전자책을 PDF로 저장합니다.
 * - 1페이지: 표지(A4에 딱 맞게)
 * - 이후: 목차 → 챕터별(각 챕터는 새 페이지에서 시작) → 마지막 저작권 문구
 * 섹션(목차/챕터/저작권)마다 독립적으로 캔버스를 렌더링하므로, 책 분량이 많아도
 * 브라우저 캔버스 크기 한계로 인한 백지 페이지가 발생하지 않습니다.
 */
export const generateEbookPdf = async (ebook: EBookState): Promise<void> => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let isFirstPage = true;

  if (ebook.coverImage) {
    pdf.addImage(coverDataUrl(ebook.coverImage), 'PNG', 0, 0, A4_W_MM, A4_H_MM);
    isFirstPage = false;
  }

  const sections = buildContentSections(ebook);
  for (const sectionHtml of sections) {
    const chunks = splitHtmlByHeight(sectionHtml, MAX_SECTION_CSS_HEIGHT);
    for (const chunkHtml of chunks) {
      const rendered = await renderSectionCanvas(chunkHtml);
      isFirstPage = addCanvasPages(pdf, rendered, isFirstPage);
    }
  }

  pdf.save(`${safeName(ebook.title)}.pdf`);
};
