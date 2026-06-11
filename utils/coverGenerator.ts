/**
 * Programmatically overlays the Korean Book Title and Author name onto the generated cover image
 * using HTML Canvas to guarantee 100% crisp, correct, and professional typography.
 */
export const overlayTextOnCover = (base64Image: string, title: string, author: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    // If we have no image due to API quota, just draw a nice clean gradient background!
    if (!base64Image || base64Image.trim() === '') {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Could not get canvas context"));
        const width = 768;
        const height = 1024;
        canvas.width = width;
        canvas.height = height;

        // Draw an elegant dark slate gradient fallback background
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#1e1b4b'); // indigo-950
        bgGrad.addColorStop(1, '#0f172a'); // slate-900
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Add some abstract shapes to make it less boring
        ctx.beginPath();
        ctx.arc(width * 0.8, height * 0.2, width * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(79, 70, 229, 0.1)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(width * 0.2, height * 0.8, width * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
        ctx.fill();

        // Proceed to text overlay logic
        drawTextOverlay(ctx, width, height, title, author);
        const finalBase64 = canvas.toDataURL('image/png').replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
        resolve(finalBase64);
      } catch (e) {
        reject(e);
      }
      return;
    }

    const img = new Image();
    
    const imgSrc = base64Image.startsWith('data:') 
      ? base64Image 
      : `data:image/png;base64,${base64Image}`;
    
    img.src = imgSrc;
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        const width = img.naturalWidth || 768;
        const height = img.naturalHeight || 1024;
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        
        drawTextOverlay(ctx, width, height, title, author);

        const dataUrl = canvas.toDataURL('image/png');
        const finalBase64 = dataUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
        
        resolve(finalBase64);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (e) => {
      // If the image failed to load but exists, try to recover with gradient
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Could not get canvas context"));
        const width = 768;
        const height = 1024;
        canvas.width = width;
        canvas.height = height;
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#312e81');
        bgGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
        drawTextOverlay(ctx, width, height, title, author);
        const finalBase64 = canvas.toDataURL('image/png').replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
        resolve(finalBase64);
      } catch (err2) {
        reject(new Error("Failed to load generated cover background image onto canvas composite canvas. Object details: " + JSON.stringify(e)));
      }
    };
  });
};

const drawTextOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number, title: string, author: string) => {

        // --- Premium Cover Framing & Vignette ---
        // Top dark linear gradient overlay for title contrast
        const topGrad = ctx.createLinearGradient(0, 0, 0, height * 0.45);
        topGrad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
        topGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
        topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, width, height * 0.45);

        // Bottom dark linear gradient overlay for author & publisher contrast
        const bottomGrad = ctx.createLinearGradient(0, height * 0.55, 0, height);
        bottomGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        bottomGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.45)');
        bottomGrad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
        ctx.fillStyle = bottomGrad;
        ctx.fillRect(0, height * 0.55, width, height * 0.45);

        // Setup common text options
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 1. Draw top brand subtitle (Minimalist Editorial Feel)
        ctx.fillStyle = 'rgba(243, 244, 246, 0.85)'; // Slate-100 with opacity
        ctx.font = `bold ${Math.round(width * 0.026)}px 'Segoe UI', 'Inter', 'Apple SD Gothic Neo', sans-serif`;
        // Draw a delicate top brand text
        ctx.fillText("I N N O V A T I O N   A I   E - B O O K", width / 2, height * 0.08);

        // Delicate decorative separator accent line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(width * 0.35, height * 0.115);
        ctx.lineTo(width * 0.65, height * 0.115);
        ctx.stroke();

        // 2. Wrap and draw the Main Korean Title
        // Dynamic font-size sizing based on the length of the Korean title
        let titleFontSize = Math.round(width * 0.075);
        if (title.length > 25) {
          titleFontSize = Math.round(width * 0.052);
        } else if (title.length > 15) {
          titleFontSize = Math.round(width * 0.062);
        } else if (title.length > 8) {
          titleFontSize = Math.round(width * 0.070);
        }

        ctx.font = `900 ${titleFontSize}px 'Malgun Gothic', 'Noto Sans KR', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif`;
        
        // Render beautiful typography shadows
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 3;

        // Custom word wrap algorithm tailored for book titles (keeping words together)
        const words = title.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        const maxTextWidth = width * 0.82; // Safe horizontal padding

        for (let i = 0; i < words.length; i++) {
          const testLine = currentLine ? currentLine + ' ' + words[i] : words[i];
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxTextWidth && i > 0) {
            lines.push(currentLine);
            currentLine = words[i];
          } else {
            currentLine = testLine;
          }
        }
        lines.push(currentLine);

        // If title wraps multiple lines, adjust start Y coordinate to balance vertical alignment
        const lineSpacing = 1.35;
        const totalHeightOfTitle = lines.length * titleFontSize * lineSpacing;
        let startY = height * 0.28 - (totalHeightOfTitle / 2) + (titleFontSize / 2);

        // Highlight colors for titles (Draw white text, with possible golden highlights for key phrases etc)
        ctx.fillStyle = '#FFFFFF';
        
        lines.forEach((lineText, idx) => {
          ctx.fillText(lineText, width / 2, startY + (idx * titleFontSize * lineSpacing));
        });

        // Clear shadows for other visual treatments
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Draw elegant divider before author section
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)'; // gold-colored translucent divider
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width * 0.45, height * 0.71);
        ctx.lineTo(width * 0.55, height * 0.71);
        ctx.stroke();

        // 3. Draw Author Section
        // Small premium tag: "저 자" (AUTHOR)
        ctx.fillStyle = '#FBBF24'; // Premium Amber/Gold color
        ctx.font = `bold ${Math.round(width * 0.026)}px 'Segoe UI', 'Inter', 'Apple SD Gothic Neo', sans-serif`;
        ctx.fillText("W R I T T E N   B Y", width / 2, height * 0.75);

        // Core Author name
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.round(width * 0.045)}px 'Malgun Gothic', 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif`;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        ctx.fillText(author, width / 2, height * 0.81);

        // Clear shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // 4. Elegant bottom publishing logo / publishing credit
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = `600 ${Math.round(width * 0.025)}px 'Segoe UI', 'Inter', sans-serif`;
        ctx.fillText("INNOVATION AI ELECTRONIC BOOK PRESS", width / 2, height * 0.92);
};
