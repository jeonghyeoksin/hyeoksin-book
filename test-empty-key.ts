import { GoogleGenAI } from '@google/genai';
try {
  const ai = new GoogleGenAI({ apiKey: "" });
  ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: "Hello"
  }).then(() => console.log("Success")).catch(e => {
    console.log("Error inside promise:", e.message);
  });
} catch(e: any) {
  console.log("Error synchronously:", e.message);
}
