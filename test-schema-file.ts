import { GoogleGenAI, Type } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: { parts: [{ text: "Hello" }, { inlineData: { data: Buffer.from("Hello world").toString('base64'), mimeType: "text/plain" } }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      }
    });
    console.log("Success");
  } catch (e: any) {
    console.error("Error Message:", e.message);
  }
}
run();
