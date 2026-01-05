
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, LetterVariations, StrategicAnalysis } from "../types";

/**
 * وظيفة داخلية لإنشاء العميل لحظياً لضمان الوصول لمفتاح API المحقون في البيئة
 */
const createAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_NOT_FOUND: مفتاح الوصول لـ Gemini غير مهيأ في بيئة العمل.");
  }
  return new GoogleGenAI({ apiKey });
};

const ARABIC_STRICT_INSTRUCTION = "هام جداً: يجب أن تكون كافة النصوص العربية بكلمات متصلة تماماً (مثال: 'الموضوع' وليس 'ا ل م و ض و ع'). يُمنع منعاً باتاً تقطيع الحروف.";

/**
 * مختبر المناورات الاستراتيجية: تحليل الخطاب الوارد قبل الرد
 */
export async function analyzeStrategicPaths(letter: Letter): Promise<StrategicAnalysis> {
    const ai = createAIClient();
    
    const systemInstruction = `أنت خبير استراتيجيات إدارية وبروتوكولية عربي. 
    حلل الخطاب المرفق وقدم تحليلاً استراتيجياً JSON.
    ${ARABIC_STRICT_INSTRUCTION}`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حلل المعاملة التالية:
        الموضوع: ${letter.subject}
        المحتوى: ${letter.body.replace(/<[^>]*>?/gm, ' ')}`,
        config: {
            systemInstruction,
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
        }
    });

    return JSON.parse(response.text || "{}") as StrategicAnalysis;
}

/**
 * توليد المسودات النهائية (باستخدام النسخة Pro لضمان أعلى جودة)
 */
export async function generateLetterVariations(params: {
    isReply: boolean,
    originalContent?: string,
    objective: string,
    sender: string,
    receiver: string,
    subject: string,
    strategy_logic?: string
}): Promise<{ variations: LetterVariations, analysis: { strategic_feedback: string[] } }> {
    const ai = createAIClient();
    const { isReply, originalContent, objective, sender, receiver, subject, strategy_logic } = params;

    const systemInstruction = `أنت خبير صياغة إداري عربي محترف. 
    المطلوب: توليد 3 نسخ (محايدة، حازمة، دبلوماسية) بتنسيق HTML.
    المنطق الاستراتيجي: ${strategy_logic || 'رسمي'}
    ${ARABIC_STRICT_INSTRUCTION}`;

    const prompt = isReply 
        ? `رد على: ${originalContent}. الهدف: ${objective}. من: ${sender} إلى: ${receiver}. الموضوع: ${subject}`
        : `إنشاء خطاب جديد: ${subject}. الهدف: ${objective}. من: ${sender} إلى: ${receiver}`;

    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview", 
        contents: prompt,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    analysis: {
                        type: Type.OBJECT,
                        properties: { strategic_feedback: { type: Type.ARRAY, items: { type: Type.STRING } } }
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
 * تنقيح النص بالحوار المباشر
 */
export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const ai = createAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `النص الحالي: ${currentBody}\nالسياق: ${context}\nالمطلوب: ${userInstruction}`,
        config: { 
            systemInstruction: `أنت خبير تنقيح لغوي. عدل النص الموفر وأعده بتنسيق HTML فقط. ${ARABIC_STRICT_INSTRUCTION}` 
        }
    });
    return response.text || currentBody;
}

/**
 * المسح الضوئي الذكي (OCR) واستخلاص البيانات
 */
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
  const ai = createAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
        { parts: [
            { text: `استخرج البيانات من صورة الخطاب المرفقة بصيغة JSON. ${ARABIC_STRICT_INSTRUCTION}` }, 
            { inlineData: { data: base64Data, mimeType: mimeType || "image/jpeg" } }
        ] }
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
                externalRefNumber: { type: Type.STRING },
                summary: { type: Type.STRING },
                category: { type: Type.STRING },
                priority: { type: Type.STRING },
                confidentiality: { type: Type.STRING },
                referenceId: { type: Type.STRING }
            }
        }
    }
  });
  return JSON.parse(response.text || "{}");
}

export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const ai = createAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص بكلمات متصلة:\n${letter.body.replace(/<[^>]*>?/gm, ' ')}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: { type: Type.STRING },
                    keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            }
        }
    });
    return JSON.parse(response.text || "{}");
}

export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const ai = createAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `اقترح 3 ردود ذكية على: ${letter.subject}`,
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
                        type: { type: Type.STRING, enum: ["positive", "negative", "neutral", "inquiry"] }
                    }
                }
            }
        }
    });
    return JSON.parse(response.text || "[]");
}

export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = createAIClient();
    const threadText = thread.map(l => `${l.from}: ${l.subject}`).join('\n');
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص السلسلة بكلمات متصلة:\n${threadText}`,
    });
    return response.text || "";
}

export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = createAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حسن لغوياً وإدارياً مع إبقاء الكلمات متصلة:\n${text}`,
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
    const ai = createAIClient();
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `ما الذي يحتاج متابعة؟ JSON:\n${JSON.stringify(list)}`,
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
    const ai = createAIClient();
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `ابحث سياقياً عن "${query}" في القائمة بكلمات متصلة.`,
    });
    return [];
}
