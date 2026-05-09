import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: "invalid_key_123" });
async function run() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: "Hello",
    });
    console.log("Success");
  } catch (e: any) {
    console.error("Error Message:", e.message);
    console.error("Error JSON:", JSON.stringify(e));
  }
}
run();
