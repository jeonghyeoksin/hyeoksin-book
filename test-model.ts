import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: "A book cover"
    });
    console.log("SUCCESS:", !!res);
  } catch (e) {
    console.error("Error with imagen-3.0-generate-002:", e.message);
  }
}
run();
