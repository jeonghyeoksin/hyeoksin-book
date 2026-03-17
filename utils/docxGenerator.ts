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
                transformation: { width: 400, height: 533 }, // 3:4 ratio approx
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
        
        // Regex to find our custom tags: [IMPORTANT], [EMPHASIS], [HIGHLIGHT]
        // We use a non-greedy match to handle multiple tags in one paragraph
        const tagRegex = /\[(IMPORTANT|EMPHASIS|HIGHLIGHT)\](.*?)\[\/\1\]/g;
        
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
            
            if (tagType === 'IMPORTANT') {
                style.color = "FF0000"; // Red
                style.bold = true;
            } else if (tagType === 'EMPHASIS') {
                style.color = "0000FF"; // Blue
                style.bold = true;
            } else if (tagType === 'HIGHLIGHT') {
                style.shading = {
                    fill: "FFFF00", // Yellow
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

  const doc = new Document({
    sections: sections.map(s => ({
        properties: s.properties || {},
        children: s.children
    })),
  });

  const blob = await Packer.toBlob(doc);
  saveDocument(blob, `${ebook.title.replace(/\s+/g, '_')}.docx`);
};