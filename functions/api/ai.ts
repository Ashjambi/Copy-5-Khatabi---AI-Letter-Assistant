
import { GoogleGenAI, Type } from "@google/genai";

export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { task, payload, config: clientConfig } = body;
    
    const apiKey = env.API_KEY || env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API_KEY_NOT_FOUND_IN_BACKEND" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // إعداد الـ Schema بناءً على نوع المهمة
    let responseSchema: any = undefined;
    
    if (task === 'generate_variations') {
        responseSchema = {
            type: Type.OBJECT,
            properties: {
                analysis: { type: Type.OBJECT, properties: { strategic_feedback: { type: Type.ARRAY, items: { type: Type.STRING } } } },
                variations: {
                    type: Type.OBJECT,
                    properties: { neutral: { type: Type.STRING }, strict: { type: Type.STRING }, diplomatic: { type: Type.STRING } },
                    required: ["neutral", "strict", "diplomatic"]
                }
            }
        };
    } else if (task === 'analyze_brief') {
        responseSchema = {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["summary", "keyPoints"]
        };
    } else if (task === 'smart_replies') {
        responseSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    objective: { type: Type.STRING },
                    tone: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ["positive", "negative", "neutral", "inquiry"] }
                },
                required: ["title", "objective", "tone", "type"]
            }
        };
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: payload,
      config: {
          ...clientConfig,
          responseMimeType: responseSchema ? "application/json" : "text/plain",
          responseSchema: responseSchema
      }
    });

    return new Response(response.text, {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      }
    });

  } catch (e: any) {
    console.error("AI Gateway Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
    });
  }
}
