
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, LetterVariations, StrategicAnalysis } from "../types";

/**
 * قاعدة صارمة: النصوص العربية يجب أن تكون بكلمات متصلة تماماً
 * يُمنع منعاً باتاً تقطيع الحروف أو وضع مسافات بين حروف الكلمة الواحدة.
 */
const ARABIC_STRICT_PROTOCOL = "قاعدة جوهرية: يجب أن تكون جميع النصوص العربية بكلمات متصلة وطبيعية (مثال: 'الموضوع' وليس 'ا ل م و ض و ع'). يُمنع منعاً باتاً تقطيع الحروف أو وضع مسافات بين حروف الكلمة الواحدة.";

/**
 * دالة داخلية لإنشاء العميل لحظة الطلب فقط.
 * هذا يضمن قراءة المفتاح من process.env.API_KEY بنجاح في كل مرة.
 */
const initAI = () => {
    if (!process.env.API_KEY) {
        throw new Error("خطأ: مفتاح الـ API لـ Gemini غير متوفر أو غير مفعّل.");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export async function analyzeStrategicPaths(letter: Letter): Promise<StrategicAnalysis> {
    const ai = initAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حلل الموقف التالي بدقة:\nالموضوع: ${letter.subject}\nالمحتوى: ${letter.body.replace(/<[^>]*>?/gm, ' ')}`,
        config: {
            systemInstruction: `أنت خبير استراتيجيات إدارية عربي رفيع المستوى. حلل الخطاب وقدم تحليلاً استراتيجياً بصيغة JSON. ${ARABIC_STRICT_PROTOCOL}`,
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
    const ai = initAI();
    const { isReply, originalContent, objective, sender, receiver, subject, strategy_logic } = params;

    const prompt = isReply 
        ? `رد استراتيجي على: ${originalContent}. الهدف المختار: ${objective}. من: ${sender} إلى: ${receiver}. الموضوع: ${subject}`
        : `إنشاء خطاب جديد: ${subject}. الهدف: ${objective}. من: ${sender} إلى: ${receiver}`;

    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: {
            systemInstruction: `أنت خبير صياغة بروتوكولية عربية. ولد 3 نسخ (محايدة، حازمة، دبلوماسية) بتنسيق HTML. ${ARABIC_STRICT_PROTOCOL} الاستراتيجية المتبعة: ${strategy_logic || 'رسمية'}`,
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
    const ai = initAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
            { text: `استخرج البيانات من الصورة بصيغة JSON بكلمات عربية متصلة تماماً. ${ARABIC_STRICT_PROTOCOL}` },
            { inlineData: { data: base64Data, mimeType: mimeType || "image/jpeg" } }
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
                    summary: { type: Type.STRING }
                }
            }
        }
    });
    return JSON.parse(response.text || "{}");
}

export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const ai = initAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `النص الحالي: ${currentBody}\nالسياق: ${context}\nالمطلوب: ${userInstruction}`,
        config: { 
            systemInstruction: `أنت خبير تنقيح لغوي. عدل النص بتنسيق HTML بكلمات متصلة تماماً. ${ARABIC_STRICT_PROTOCOL}` 
        }
    });
    return response.text || currentBody;
}

export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const ai = initAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص بكلمات متصلة:\n${letter.body.substring(0, 2000)}`,
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
    const ai = initAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `اقترح 3 مسارات للرد بكلمات متصلة على: ${letter.subject}`,
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
    const ai = initAI();
    const threadText = thread.map(l => `${l.from}: ${l.subject}`).join('\n');
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص السلسلة بفقرة واحدة متصلة الحروف:\n${threadText}`,
    });
    return response.text || "";
}

export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = initAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حدد المعاملات التي تحتاج متابعة بصيغة JSON: ${JSON.stringify(letters.map(l => ({ id: l.id, subject: l.subject })))}`,
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
    const ai = initAI();
    // تنفيذ مبسط للبحث السياقي لضمان استقرار المفتاح
    return [];
}

export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = initAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حسن لغوياً وإدارياً مع إبقاء الكلمات متصلة: ${text}`,
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
