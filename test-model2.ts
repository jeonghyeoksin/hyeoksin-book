import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res: any = await ai.models.generateImages({
      model: "imagen-4.0-ultra-generate-001",
      prompt: "A book cover",
      config: {
        numberOfImages: 1,
        aspectRatio: "3:4"
      }
    });
    console.log("SUCCESS:", JSON.stringify(res, null, 2).slice(0, 500));
  } catch (e) {
    console.error("Error:", e.message);
  }
}
run();
