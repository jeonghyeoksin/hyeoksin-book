import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } from "docx";
import { EBookState } from "../types";

// Helper to convert Base64 string to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Native download helper to replace file-saver and avoid import errors
const saveDocument = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const generateAndDownloadDocx = async (ebook: EBookState) => {
  const sections = [];

  // Title Page
  const titleChildren: (Paragraph)[] = [
    new Paragraph({
      text: ebook.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { before: 4000, after: 1000 },
    }),
    new Paragraph({
      text: ebook.author ? `저자: ${ebook.author}` : "저자: 미정",
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: "생성: 혁신 전자책 AI",
      alignment: AlignmentType.CENTER,
      spacing: { after: 4000 },
    }),
  ];

  if (ebook.coverImage) {
    titleChildren.splice(2, 0, new Paragraph({
        children: [
            new ImageRun({
                data: base64ToUint8Array(ebook.coverImage),
                transformation: { width: 400, height: 566 }, // A4 ratio (1:√2)
            } as any),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 1000 },
    }));
  }

  sections.push({
    children: titleChildren,
  });

  // Table of Contents (Simulated visually)
  const outlineChildren = [
    new Paragraph({
      text: "목차",
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 500 },
    }),
    ...ebook.outline.map(chapter => new Paragraph({
      text: chapter,
      bullet: { level: 0 }
    }))
  ];

  sections.push({
    properties: {
        page: {
            break: true
        }
    },
    children: outlineChildren
  });


  // Chapters
  for (const chapter of ebook.chapters) {
    const chapterChildren: (Paragraph)[] = [
      new Paragraph({
        text: chapter.title,
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { after: 300 },
      }),
    ];

    if (chapter.imageData) {
      chapterChildren.push(new Paragraph({
        children: [
            new ImageRun({
                data: base64ToUint8Array(chapter.imageData),
                transformation: { width: 400, height: 300 }, // 4:3 ratio
            } as any),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 500, before: 300 },
      }));
    }

    // Split content by newlines to create paragraphs. 
    // Since we forbid markdown, we treat every non-empty line as a paragraph.
    const paragraphs = chapter.content.split('\n').filter(p => p.trim() !== '');
    
    paragraphs.forEach(p => {
        const text = p.trim();
        const children: TextRun[] = [];
        
        // Regex to find our custom tags: [RED], [BLUE], [GREEN], [YELLOW_BG], or legacy [IMPORTANT], [EMPHASIS], [HIGHLIGHT]
        // We use a non-greedy match to handle multiple tags in one paragraph
        const tagRegex = /\[(RED|BLUE|GREEN|YELLOW_BG|IMPORTANT|EMPHASIS|HIGHLIGHT)\](.*?)\[\/\1\]/g;
        
        let lastIndex = 0;
        let match;
        
        while ((match = tagRegex.exec(text)) !== null) {
            // Add plain text before the match
            if (match.index > lastIndex) {
                children.push(new TextRun({
                    text: text.substring(lastIndex, match.index),
                    size: 24,
                }));
            }
            
            const tagType = match[1];
            const content = match[2];
            
            const style: any = { text: content, size: 24 };
            
            if (tagType === 'IMPORTANT' || tagType === 'RED') {
                style.color = "FF0000"; // Red
                style.bold = true;
            } else if (tagType === 'EMPHASIS' || tagType === 'BLUE') {
                style.color = "0000FF"; // Blue
                style.bold = true;
            } else if (tagType === 'GREEN') {
                style.color = "008000"; // Green
                style.bold = true;
            } else if (tagType === 'HIGHLIGHT' || tagType === 'YELLOW_BG') {
                style.color = "000000"; // Black text
                style.shading = {
                    fill: "FFFF00", // Yellow background
                };
            }
            
            children.push(new TextRun(style));
            lastIndex = tagRegex.lastIndex;
        }
        
        // Add remaining plain text
        if (lastIndex < text.length) {
            children.push(new TextRun({
                text: text.substring(lastIndex),
                size: 24,
            }));
        }

        chapterChildren.push(new Paragraph({
            children: children.length > 0 ? children : [new TextRun({ text: text, size: 24 })],
            spacing: { after: 200, line: 360 }, // Increased line spacing for better readability and more pages
        }));
    });

    sections.push({
      children: chapterChildren,
    });
  }

  // --- ADD COPYRIGHT SECTION ---
  const currentYear = new Date().getFullYear();
  sections.push({
      children: [
          new Paragraph({
              children: [new TextRun({ text: "저작권 및 면책 조항", bold: true, size: 32 })],
              spacing: { before: 1000, after: 400 },
          }),
          new Paragraph({
              children: [new TextRun({ text: `ⓒ ${currentYear}. ${ebook.author || '저자'}. All rights reserved.`, size: 20 })],
              spacing: { after: 200 },
          }),
          new Paragraph({
              children: [new TextRun({ text: "본 전자책의 모든 내용의 저작권은 저자에게 있습니다. 무단 전재 및 재배포, 복사를 엄격히 금지합니다.", size: 20 })],
              spacing: { after: 200 },
          }),
          new Paragraph({
              children: [new TextRun({ text: "본 저작물은 저작권법에 의해 보호를 받는 저작물이므로, 저작권자의 서면 동의 없는 내용의 일부 또는 전부의 무단 이용을 금지합니다.", size: 20 })],
              spacing: { after: 200 },
          }),
      ]
  });

  const doc = new Document({
    sections: sections.map(s => ({
        properties: s.properties || {},
        children: s.children
    })),
  });

  const blob = await Packer.toBlob(doc);
  saveDocument(blob, `${ebook.title.replace(/\s+/g, '_')}.docx`);
};