
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, LetterVariations, StrategicAnalysis } from "../types";

// قاعدة صارمة: الكلمات العربية يجب أن تكون متصلة تماماً في كافة المخرجات
const ARABIC_STRICT_PROTOCOL = "قاعدة جوهرية: يجب أن تكون جميع النصوص العربية بكلمات متصلة وطبيعية (مثال: 'الموضوع' وليس 'ا ل م و ض و ع'). يُمنع منعاً باتاً تقطيع الحروف أو وضع مسافات بين حروف الكلمة الواحدة.";

/**
 * وظيفة داخلية لضمان قراءة المفتاح الصحيح لحظة الطلب فقط
 * هذا يحل مشكلة "API Key must be set when running in a browser"
 */
const callGemini = async (config: { model: string, systemInstruction: string, contents: any, responseMimeType?: string, responseSchema?: any }) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API_KEY_MISSING: مفتاح الوصول لـ Gemini غير متاح في بيئة التنفيذ.");
    
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
        model: config.model,
        contents: config.contents,
        config: {
            systemInstruction: `${config.systemInstruction}\n${ARABIC_STRICT_PROTOCOL}`,
            responseMimeType: config.responseMimeType,
            responseSchema: config.responseSchema
        }
    });
    return response;
};

export async function analyzeStrategicPaths(letter: Letter): Promise<StrategicAnalysis> {
    const response = await callGemini({
        model: "gemini-3-flash-preview",
        systemInstruction: "أنت خبير استراتيجيات إدارية عربي. حلل الخطاب وقدم تحليلاً استراتيجياً JSON.",
        contents: `حلل الموقف التالي:\nالموضوع: ${letter.subject}\nالمحتوى: ${letter.body.replace(/<[^>]*>?/gm, ' ')}`,
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                sender_intent: { type: Type.STRING },
                power_balance: { type: Type.STRING },
                risks: { type: Type.ARRAY, items: { type: Type.STRING } },
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
            required: ["sender_intent", "paths"]
        }
    });
    return JSON.parse(response.text || "{}");
}

export async function generateLetterVariations(params: {
    isReply: boolean,
    originalContent?: string,
    objective: string,
    sender: string,
    receiver: string,
    subject: string,
    strategy_logic?: string
}): Promise<{ variations: LetterVariations, analysis: { strategic_feedback: string[] } }> {
    const { isReply, originalContent, objective, sender, receiver, subject, strategy_logic } = params;
    const prompt = isReply 
        ? `رد استراتيجي على: ${originalContent}. الهدف: ${objective}. من: ${sender} إلى: ${receiver}. الموضوع: ${subject}`
        : `إنشاء خطاب جديد: ${subject}. الهدف: ${objective}. من: ${sender} إلى: ${receiver}`;

    const response = await callGemini({
        model: "gemini-3-pro-preview",
        systemInstruction: `أنت خبير صياغة بروتوكولية. ولد 3 نسخ HTML. الاستراتيجية: ${strategy_logic || 'رسمية'}`,
        contents: prompt,
        responseMimeType: "application/json",
        responseSchema: {
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
        }
    });
    return JSON.parse(response.text || "{}");
}

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
    const response = await callGemini({
        model: "gemini-3-flash-preview",
        systemInstruction: "أنت خبير أرشفة إداري. استخرج البيانات من الصورة بصيغة JSON بكلمات متصلة.",
        contents: [
            { text: "استخرج البيانات من الوثيقة المرفقة:" },
            { inlineData: { data: base64Data, mimeType: mimeType || "image/jpeg" } }
        ],
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                subject: { type: Type.STRING },
                from: { type: Type.STRING },
                to: { type: Type.STRING },
                date: { type: Type.STRING },
                externalRefNumber: { type: Type.STRING },
                summary: { type: Type.STRING },
                priority: { type: Type.STRING },
                confidentiality: { type: Type.STRING }
            }
        }
    });
    return JSON.parse(response.text || "{}");
}

export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const response = await callGemini({
        model: "gemini-3-flash-preview",
        systemInstruction: "لخص الخطاب الإداري بكلمات متصلة.",
        contents: `لخص المعاملة:\n${letter.body.replace(/<[^>]*>?/gm, ' ')}`,
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        }
    });
    return JSON.parse(response.text || "{}");
}

export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const response = await callGemini({
        model: "gemini-3-flash-preview",
        systemInstruction: "اقترح 3 مسارات للرد على المعاملة بصيغة JSON.",
        contents: `الموضوع: ${letter.subject}\nالمحتوى: ${letter.body.substring(0, 1000)}`,
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
    });
    return JSON.parse(response.text || "[]");
}

export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const response = await callGemini({
        model: "gemini-3-flash-preview",
        systemInstruction: "أنت خبير تنقيح نصوص. عدل النص الموفر حسب تعليمات المستخدم وأعده بصيغة HTML.",
        contents: `النص: ${currentBody}\nالتوجيه: ${userInstruction}\nالسياق: ${context}`
    });
    return response.text || currentBody;
}

export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const response = await callGemini({
        model: "gemini-3-flash-preview",
        systemInstruction: "لخص السلسلة الإدارية بفقرة واحدة متصلة الحروف.",
        contents: thread.map(l => `${l.from}: ${l.subject}`).join('\n')
    });
    return response.text || "";
}

export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const response = await callGemini({
        model: "gemini-3-flash-preview",
        systemInstruction: "حدد المعاملات التي تحتاج متابعة عاجلة بصيغة JSON.",
        contents: JSON.stringify(letters.map(l => ({ id: l.id, subject: l.subject }))),
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
    });
    return JSON.parse(response.text || "[]");
}

export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<any[]> {
    const response = await callGemini({
        model: "gemini-3-flash-preview",
        systemInstruction: "ابحث سياقياً في القائمة وأعد النتائج بصيغة JSON.",
        contents: `ابحث عن: ${query}\nالبيانات: ${JSON.stringify(letters.map(l => ({ id: l.id, subject: l.subject })))}`,
        responseMimeType: "application/json"
    });
    return JSON.parse(response.text || "[]");
}

export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const response = await callGemini({
        model: "gemini-3-flash-preview",
        systemInstruction: "حسن الصياغة الإدارية وقدم اقتراحات JSON.",
        contents: text,
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
    });
    return JSON.parse(response.text || "[]");
}
