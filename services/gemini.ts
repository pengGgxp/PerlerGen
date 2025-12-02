
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysis } from "../types";
import { translations, Language } from "../translations";

export const analyzeBeadPattern = async (imageBase64: string, lang: Language): Promise<AIAnalysis> => {
  if (!process.env.API_KEY) {
    console.warn("No API Key found for Gemini");
    const t = translations[lang];
    return {
      title: t.aiError,
      description: t.aiErrorDesc,
      difficulty: "Medium",
      suggestedUsage: t.aiUsageDeco
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;

    const promptText = lang === 'zh' 
      ? "分析这张图片作为拼豆（像素画）项目的潜力。请用中文回答。提供一个吸引人的标题，一段简短有趣的描述，估计儿童制作的难度等级（简单/中等/困难），以及成品用途建议（例如：钥匙扣、杯垫、冰箱贴）。"
      : "Analyze this image for a 'Perler Bead' (pixel art) project. Provide a catchy title, a short fun description, an estimated difficulty level (Easy/Medium/Hard) for a child, and a suggestion for what to use the finished product for (e.g. Keychain, Coaster, Fridge Magnet).";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64
            }
          },
          {
            text: promptText
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            suggestedUsage: { type: Type.STRING },
          },
          required: ["title", "description", "difficulty", "suggestedUsage"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as AIAnalysis;

  } catch (error) {
    console.error("Gemini analysis failed:", error);
    const t = translations[lang];
    return {
      title: t.aiError,
      description: t.aiErrorDesc,
      difficulty: t.aiDiffUnknown,
      suggestedUsage: t.aiUsageDeco
    };
  }
};
