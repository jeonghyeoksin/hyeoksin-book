import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: "invalid_key_123" });
async function run() {
  try {
    const response = await ai.models.generateContent({
      model: 'models/gemini-3.1-pro-preview',
      contents: "Hello",
    });
    console.log("Success");
  } catch (e: any) {
    const errorStr = JSON.stringify(e).toUpperCase();
    const msg = (e.message || "").toUpperCase();
    console.log("errorStr:", errorStr);
    console.log("msg:", msg);
  }
}
run();
