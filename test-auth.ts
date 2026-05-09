import { GoogleGenAI } from '@google/genai';
try {
  const ai = new GoogleGenAI({ apiKey: "" });
  console.log("Created successfully");
} catch(e: any) {
  console.log("Error synchronously:", e.message);
}
