
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, LetterVariations, StrategicAnalysis } from "../types";

/**
 * تهيئة العميل مباشرة عند الاستدعاء لضمان قراءة المفتاح
 */
const createClient = () => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY is not defined in environment");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * المحرك الاستراتيجي: تحليل الموقف الإداري بعمق (الفكرة الخارج عن الصندوق)
 */
export async function analyzeStrategicPaths(letter: Letter): Promise<StrategicAnalysis> {
    const ai = createClient();
    const systemInstruction = `أنت خبير استراتيجيات إدارية عربي رفيع المستوى. 
    مهمتك تحليل الخطاب الوارد بعمق واقتراح 3 مسارات استراتيجية للرد.
    يجب أن تكون الكلمات العربية متصلة تماماً وطبيعية.
    أخرج المخرجات بصيغة JSON حصراً.`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حلل الخطاب التالي استراتيجياً:
        الموضوع: ${letter.subject}
        المحتوى: ${letter.body.replace(/<[^>]*>?/gm, ' ')}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    intent: { type: Type.STRING, description: "النية الحقيقية للمرسل خلف الكلمات" },
                    powerBalance: { type: Type.STRING, description: "تحليل ميزان القوة (أعلى/أقل/متساوي)" },
                    risks: { type: Type.ARRAY, items: { type: Type.STRING }, description: "المخاطر المحتملة في الرد" },
                    paths: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                title: { type: Type.STRING },
                                description: { type: Type.STRING },
                                logic: { type: Type.STRING },
                                impact: { type: Type.STRING },
                                suggestedObjective: { type: Type.STRING }
                            }
                        }
                    }
                },
                required: ["intent", "paths"]
            }
        }
    });

    return JSON.parse(response.text || "{}") as StrategicAnalysis;
}

/**
 * توليد المسودات بناءً على المسار الاستراتيجي المختار
 */
export async function generateLetterVariations(params: {
    isReply: boolean,
    originalContent?: string,
    objective: string,
    sender: string,
    receiver: string,
    subject: string,
    strategyLogic?: string
}): Promise<{ variations: LetterVariations, analysis: { strategic_feedback: string[] } }> {
    const ai = createClient();
    const { isReply, originalContent, objective, sender, receiver, subject, strategyLogic } = params;

    const systemInstruction = `أنت خبير صياغة إداري وبروتوكولي. الكلمات العربية متصلة.
    المطلوب توليد 3 نسخ (محايدة، حازمة، دبلوماسية) بتنسيق HTML.
    الاستراتيجية المتبعة: ${strategyLogic || 'رسمية معيارية'}`;

    const prompt = isReply 
        ? `رد استراتيجي على: ${originalContent}. الهدف: ${objective}. من: ${sender} إلى: ${receiver}. الموضوع: ${subject}`
        : `خطاب جديد: ${subject}. الهدف: ${objective}. من: ${sender} إلى: ${receiver}`;

    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview", // نستخدم برو لأعلى جودة في الصياغة النهائية
        contents: prompt,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    analysis: {
                        type: Type.OBJECT,
                        properties: {
                            strategic_feedback: { type: Type.ARRAY, items: { type: Type.STRING } }
                        }
                    },
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
            }
        }
    });

    return JSON.parse(response.text || "{}");
}

/**
 * تنقيح النص بالحوار (Chat Refinement)
 */
export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const ai = createClient();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `النص الحالي: ${currentBody}\nالسياق: ${context}\nالمطلوب: ${userInstruction}. أعد النص المعدل فقط بكلمات عربية متصلة وبصيغة HTML.`,
        config: { systemInstruction: "أنت خبير تنقيح لغوي إداري." }
    });
    return response.text || currentBody;
}

// الدوال المساعدة الأخرى (OCR, Brief, etc) يتم استدعاؤها بـ createClient()
export async function extractDetailsFromLetterImage(
  base64Data: string,
  mimeType: string,
  departments: string[],
  letterTypes: string[],
  priorityLevels: string[],
  confidentialityLevels: string[],
  existingCategories: string[],
  existingLetters: any[]
): Promise<ExtractedLetterDetails> {
  const ai = createClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
        { parts: [{ text: "استخرج البيانات من الصورة المرفقة بكلمات متصلة وبصيغة JSON." }, { inlineData: { data: base64Data, mimeType: mimeType || "image/jpeg" } }] }
    ],
    config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                subject: { type: Type.STRING },
                from: { type: Type.STRING },
                to: { type: Type.STRING },
                date: { type: Type.STRING },
                summary: { type: Type.STRING }
            }
        }
    }
  });
  return JSON.parse(response.text || "{}");
}

export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const ai = createClient();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص الخطاب التالي: ${letter.subject}\n${letter.body.replace(/<[^>]*>?/gm, ' ')}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: { type: Type.STRING },
                    keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["summary", "keyPoints"]
            }
        }
    });
    return JSON.parse(response.text || "{}");
}

export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    // تم دمج هذا في المحرك الاستراتيجي ولكن نتركها للتوافق مع المكونات الأخرى
    const ai = createClient();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `اقترح 3 ردود قصيرة على: ${letter.subject}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        objective: { type: Type.STRING },
                        tone: { type: Type.STRING },
                        type: { type: Type.STRING }
                    }
                }
            }
        }
    });
    return JSON.parse(response.text || "[]");
}

export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = createClient();
    const threadText = thread.map(l => `${l.from}: ${l.subject}`).join('\n');
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص هذه السلسلة: ${threadText}`,
    });
    return response.text || "";
}

export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = createClient();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حسن النص التالي: ${text}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        original_part: { type: Type.STRING },
                        suggested_improvement: { type: Type.STRING },
                        reason: { type: Type.STRING }
                    }
                }
            }
        }
    });
    return JSON.parse(response.text || "[]");
}

export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = createClient();
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `ما الذي يحتاج متابعة؟ ${JSON.stringify(list)}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        letterId: { type: Type.STRING },
                        summary: { type: Type.STRING }
                    }
                }
            }
        }
    });
    return JSON.parse(response.text || "[]");
}

export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<any[]> {
    const ai = createClient();
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `ابحث عن "${query}" في: ${JSON.stringify(list)}`,
    });
    return JSON.parse(response.text || "[]");
}
