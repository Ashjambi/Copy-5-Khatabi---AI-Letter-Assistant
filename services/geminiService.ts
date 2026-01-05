
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, LetterVariations, StrategicAnalysis } from "../types";

// إعداد المحرك الأساسي - يتم استخدام المفتاح من بيئة التشغيل حصراً
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const ARABIC_STRICT_INSTRUCTION = "قاعدة لغوية صارمة: يجب أن تكون جميع المخرجات العربية بكلمات طبيعية متصلة الحروف (مثل: 'خطاب' وليس 'خ ط ا ب'). يُمنع تقطيع الحروف نهائياً.";

/**
 * تحليل النوايا والمسارات الاستراتيجية (الميزة المعطلة)
 */
export async function analyzeStrategicPaths(letter: Letter): Promise<StrategicAnalysis> {
    const ai = getAI();
    const content = letter.body.replace(/<[^>]*>?/gm, ' ');
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `حلل هذا الخطاب إدارياً واستراتيجياً بكلمات عربية متصلة:\nالموضوع: ${letter.subject}\nالمحتوى: ${content}`,
        config: {
            systemInstruction: `أنت خبير استراتيجيات إداري. ${ARABIC_STRICT_INSTRUCTION} قم بكشف نوايا المرسل وميزان القوة والمخاطر.`,
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
                                suggestedObjective: { type: Type.STRING }
                            }
                        }
                    }
                },
                required: ["sender_intent", "risks"]
            }
        }
    });

    return JSON.parse(response.text || "{}");
}

/**
 * توليد مسودات الخطابات (التوليد الذكي)
 */
export async function generateLetterVariations(params: {
    isReply: boolean,
    originalContent?: string,
    objective: string,
    sender: string,
    receiver: string,
    subject: string,
    principles: string
}): Promise<{ variations: LetterVariations, analysis: { strategic_feedback: string[] } }> {
    const ai = getAI();
    const { isReply, originalContent, objective, sender, receiver, subject, principles } = params;

    const prompt = isReply 
        ? `رد على: ${originalContent}\nالهدف: ${objective}\nمن: ${sender} إلى: ${receiver}. الموضوع: ${subject}`
        : `أنشئ خطاباً جديداً: الموضوع: ${subject}. المحتوى المطلوب: ${objective}. من: ${sender} إلى: ${receiver}`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            systemInstruction: `أنت خبير صياغة بروتوكولات. ${ARABIC_STRICT_INSTRUCTION} قدم 3 نسخ (محايدة، حازمة، دبلوماسية) بصيغة HTML. التخصيص: ${principles}`,
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

/**
 * المسح الضوئي واستخراج البيانات (OCR الذكي)
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
    const ai = getAI();
    const context = existingLetters.slice(0, 10).map(l => l.subject).join(', ');

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType } },
                { text: `استخرج بيانات هذا الخطاب الرسمي بدقة. ${ARABIC_STRICT_INSTRUCTION}` }
            ]
        },
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
                    referenceId: { type: Type.STRING }
                },
                required: ["subject", "from", "to"]
            }
        }
    });

    return JSON.parse(response.text || "{}");
}

/**
 * تلخيص الخطاب والنقاط المهمة
 */
export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص هذا الخطاب واستخرج نقاط العمل: الموضوع: ${letter.subject}\nالمحتوى: ${letter.body.replace(/<[^>]*>?/gm, ' ')}`,
        config: {
            systemInstruction: `أنت مساعد إداري ذكي. ${ARABIC_STRICT_INSTRUCTION}`,
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
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `اقترح 3 مسارات للرد على: ${letter.subject}`,
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

export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `النص الحالي: ${currentBody}\nالتعديل المطلوب: ${userInstruction}`,
        config: { systemInstruction: `أنت خبير صياغة. ${ARABIC_STRICT_INSTRUCTION} أعد النص بتنسيق HTML.` }
    });
    return response.text || currentBody;
}

export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حسن صياغة هذا النص: ${text}`,
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
    const ai = getAI();
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حدد ما يحتاج متابعة: ${JSON.stringify(list)}`,
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
    const ai = getAI();
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `ابحث سياقياً عن "${query}" في: ${JSON.stringify(list)}`,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "[]");
}

export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = getAI();
    const text = thread.map(l => l.subject).join(' -> ');
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص التسلسل: ${text}`
    });
    return response.text || "";
}
