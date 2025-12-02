import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysis } from "../types";

export const analyzeBeadPattern = async (imageBase64: string): Promise<AIAnalysis> => {
  if (!process.env.API_KEY) {
    console.warn("No API Key found for Gemini");
    return {
      title: "Bead Pattern",
      description: "A cool pixel art design.",
      difficulty: "Medium",
      suggestedUsage: "Coasters, keychains, or wall art."
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Remove header if present (data:image/png;base64,...)
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg", // Assuming jpeg or png, generic usually works or detect from header
              data: cleanBase64
            }
          },
          {
            text: "Analyze this image for a 'Perler Bead' (pixel art) project. Provide a catchy title, a short fun description, an estimated difficulty level (Easy/Medium/Hard) for a child, and a suggestion for what to use the finished product for (e.g. Keychain, Coaster, Fridge Magnet)."
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
    return {
      title: "Custom Pattern",
      description: "Ready to fuse!",
      difficulty: "Unknown",
      suggestedUsage: "Decoration"
    };
  }
};