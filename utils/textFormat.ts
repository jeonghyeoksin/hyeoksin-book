// 본문 텍스트를 가독성 좋은 문단 배열로 분리하는 공용 유틸
// (PDF / DOCX / 화면 미리보기에서 동일하게 사용)

const TAGS = ['RED', 'BLUE', 'GREEN', 'YELLOW_BG', 'IMPORTANT', 'EMPHASIS', 'HIGHLIGHT'];

// [RED]...[/RED] 같은 강조 태그가 모두 짝이 맞는지 검사 (문단 분리 시 태그가 잘리지 않게 보호)
const isTagBalanced = (s: string): boolean =>
  TAGS.every((t) => {
    const open = (s.match(new RegExp(`\\[${t}\\]`, 'g')) || []).length;
    const close = (s.match(new RegExp(`\\[\\/${t}\\]`, 'g')) || []).length;
    return open === close;
  });

const collapse = (s: string): string => s.replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();

/**
 * 원문을 문단 단위로 분리한다.
 * 1) 빈 줄(\n\n) 기준 분리 → 2) 빈 줄이 없으면 단일 줄바꿈 기준 분리
 * 3) 그래도 너무 긴 문단은 약 3문장 단위로 추가 분리 (단, 강조 태그가 잘리지 않도록 보호)
 */
export const splitIntoParagraphs = (raw: string): string[] => {
  const text = (raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  let blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length <= 1) {
    const byLine = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (byLine.length > 1) blocks = byLine;
  }

  const MAX_LEN = 320;
  const result: string[] = [];

  for (const block of blocks) {
    const clean = collapse(block);
    if (clean.length <= MAX_LEN) {
      result.push(clean);
      continue;
    }

    // 문장 단위로 쪼개되, 약 3문장 + 최소 120자 + 태그 균형이 맞을 때만 문단을 끊는다.
    const sentences = clean.match(/[^.!?。]*[.!?。]+(?:\s|$)|[^.!?。]+$/g) || [clean];
    let buf = '';
    let count = 0;
    for (const sentence of sentences) {
      buf += sentence;
      count++;
      if (count >= 3 && buf.trim().length >= 120 && isTagBalanced(buf)) {
        result.push(buf.trim());
        buf = '';
        count = 0;
      }
    }
    if (buf.trim()) result.push(buf.trim());
  }

  return result;
};
