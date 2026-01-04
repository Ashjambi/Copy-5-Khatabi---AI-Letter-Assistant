
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, LetterVariations, StrategicAnalysis } from "../types";

// تهيئة العميل باستخدام المفتاح من البيئة حصراً كما هو مطلوب
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * المختبر الاستراتيجي: تحليل الموقف الإداري قبل الرد
 */
export async function analyzeStrategicPaths(letter: Letter): Promise<StrategicAnalysis> {
    const ai = getAI();
    const systemInstruction = `أنت خبير استراتيجيات إدارية عربي رفيع المستوى.
    حلل الخطاب الوارد وحدد النبرة، ميزان القوة، وثلاث استراتيجيات رد احترافية.
    قواعد المخرجات:
    1. كلمات عربية متصلة تماماً.
    2. مخرجات JSON دقيقة.`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `الموضوع: ${letter.subject}\nمن: ${letter.from}\nالمحتوى: ${letter.body.replace(/<[^>]*>?/gm, ' ')}`,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    sender_vibe: { type: Type.STRING },
                    power_dynamic: { type: Type.STRING, enum: ['superior', 'equal', 'subordinate'] },
                    critical_points: { type: Type.ARRAY, items: { type: Type.STRING } },
                    suggested_strategies: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING, enum: ['authority', 'partnership', 'delay'] },
                                title: { type: Type.STRING },
                                impact: { type: Type.STRING },
                                logic: { type: Type.STRING },
                                objective: { type: Type.STRING }
                            }
                        }
                    }
                },
                required: ["sender_vibe", "power_dynamic", "suggested_strategies"]
            }
        }
    });
    
    return JSON.parse(response.text || "{}");
}

/**
 * صياغة المسودات الذكية بناءً على الاستراتيجية المختارة
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
    const ai = getAI();
    const { isReply, originalContent, objective, sender, receiver, subject, strategy_logic } = params;

    const systemInstruction = `أنت خبير صياغة إداري عربي. الكلمات العربية متصلة دائماً.
    المطلوب: توليد 3 نسخ (محايدة، حازمة، دبلوماسية) بتنسيق HTML.
    المنطق الاستراتيجي المتبع: ${strategy_logic || 'رسمية عادية'}`;

    const prompt = isReply 
        ? `رد على خطاب مرجعي. المرجع: ${originalContent}\nالهدف المختار: ${objective}\nمن: ${sender} إلى: ${receiver}\nالموضوع: ${subject}`
        : `إنشاء خطاب جديد بالكامل. الهدف: ${objective}\nمن: ${sender} إلى: ${receiver}\nالموضوع: ${subject}`;

    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview", // استخدام برو لضمان جودة الصياغة
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
 * تنقيح النص بالحوار
 */
export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `النص الحالي: ${currentBody}\nالسياق: ${context}\nالتعديل المطلوب: ${userInstruction}`,
        config: { 
            systemInstruction: "أنت خبير صياغة. عدل النص الموفر لغوياً وإدارياً مع إبقاء الكلمات العربية متصلة. أعد النص فقط." 
        }
    });
    return response.text || currentBody;
}

// بقية الدوال الخدماتية مع ضمان استخدام getAI()...
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
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
        parts: [
            { text: "حلل صورة الخطاب المرفقة واستخرج البيانات بصيغة JSON بكلمات عربية متصلة." },
            { inlineData: { data: base64Data, mimeType: mimeType || "image/jpeg" } }
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
                summary: { type: Type.STRING },
                category: { type: Type.STRING }
            }
        }
    }
  });
  return JSON.parse(response.text || "{}");
}

export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const ai = getAI();
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
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `اقترح 3 مسارات للرد على: ${letter.subject}. المحتوى: ${letter.body.substring(0,500)}`,
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
    const ai = getAI();
    const threadText = thread.map(l => `${l.from}: ${l.subject}`).join('\n');
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص هذه السلسلة: ${threadText}`,
    });
    return response.text || "";
}

export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = getAI();
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
    const ai = getAI();
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
    const ai = getAI();
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `ابحث عن "${query}" في: ${JSON.stringify(list)}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        letterId: { type: Type.STRING },
                        relevanceReason: { type: Type.STRING },
                        confidenceScore: { type: Type.NUMBER }
                    }
                }
            }
        }
    });
    return JSON.parse(response.text || "[]");
}
