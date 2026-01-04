
import { GoogleGenAI, Type } from "@google/genai";

export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { task, payload } = body;
    
    const apiKey = env.API_KEY || env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API_KEY_NOT_CONFIGURED_IN_DASHBOARD" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    let modelName = "gemini-3-flash-preview";
    let responseSchema: any = undefined;
    let systemInstruction = "أنت خبير صياغة إداري عربي. الكلمات العربية يجب أن تكون متصلة تماماً.";
    let finalPrompt = payload;

    // تشعيب المهام بناءً على الطلب
    if (task === 'generate_variations') {
        modelName = "gemini-3-pro-preview"; // للمهام المعقدة نستخدم النسخة الاحترافية
        const { isReply, originalContent, objective, sender, receiver, subject, principles } = payload;
        systemInstruction += ` المطلوب توليد 3 نسخ بصيغة HTML (neutral, strict, diplomatic). الأسلوب المفضل: ${principles}`;
        finalPrompt = isReply 
            ? `رد على: ${originalContent}. الهدف: ${objective}. من: ${sender} إلى: ${receiver}. الموضوع: ${subject}.`
            : `خطاب جديد: ${subject}. المحتوى المطلوب: ${objective}. من: ${sender} إلى: ${receiver}.`;
        
        responseSchema = {
            type: Type.OBJECT,
            properties: {
                analysis: { type: Type.OBJECT, properties: { strategic_feedback: { type: Type.ARRAY, items: { type: Type.STRING } } } },
                variations: {
                    type: Type.OBJECT,
                    properties: {
                        neutral: { type: Type.STRING },
                        strict: { type: Type.STRING },
                        diplomatic: { type: Type.STRING }
                    },
                    required: ["neutral", "strict", "diplomatic"]
                }
            }
        };
    } else if (task === 'smart_replies') {
        systemInstruction += " اقترح 3 مسارات رد ذكية. تأكد أن الـ tone واحدة من: ['محايدة', 'رسمية صارمة', 'دبلوماسية'].";
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
    } else if (task === 'analyze_brief') {
        responseSchema = {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["summary", "keyPoints"]
        };
    } else if (task === 'enhance_text') {
        responseSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    original_part: { type: Type.STRING },
                    suggested_improvement: { type: Type.STRING },
                    reason: { type: Type.STRING }
                }
            }
        };
    } else if (task === 'follow_up') {
        responseSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    letterId: { type: Type.STRING },
                    summary: { type: Type.STRING }
                }
            }
        };
    } else if (task === 'smart_search') {
        responseSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    letterId: { type: Type.STRING },
                    relevanceReason: { type: Type.STRING },
                    confidenceScore: { type: Type.NUMBER }
                }
            }
        };
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: finalPrompt,
      config: {
          systemInstruction,
          responseMimeType: responseSchema ? "application/json" : "text/plain",
          responseSchema: responseSchema
      }
    });

    return new Response(response.text, {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e: any) {
    console.error("AI Proxy Error:", e);
    // إرجاع رمز الخطأ الأصلي إذا كان متاحاً (مثل 429)
    const status = e.message?.includes('429') ? 429 : 500;
    return new Response(JSON.stringify({ error: e.message }), { 
        status,
        headers: { "Content-Type": "application/json" }
    });
  }
}
