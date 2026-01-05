
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, LetterVariations, StrategicAnalysis } from "../types";

/**
 * قاعدة لغوية صارمة لمنع تقطيع الحروف العربية في المخرجات
 */
const ARABIC_STRICT_INSTRUCTION = "قاعدة لغوية صارمة: يجب أن تكون جميع المخرجات العربية بكلمات طبيعية متصلة الحروف (مثل: 'خطاب' وليس 'خ ط ا ب'). يُمنع تقطيع الحروف أو وضع مسافات بين حروف الكلمة الواحدة نهائياً.";

/**
 * دالة استخراج البيانات من صورة الخطاب (OCR)
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // سياق المعاملات الموجودة للربط الذكي
    const lettersContext = existingLetters.slice(0, 15).map(l => 
        `- معرف: ${l.id}, موضوع: ${l.subject}, مرجع: ${l.internalRefNumber || l.externalRefNumber}`
    ).join('\n');

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType: mimeType } },
                { text: `استخرج بيانات هذا الخطاب الرسمي بدقة وحولها لصيغة JSON. 
                ${ARABIC_STRICT_INSTRUCTION}
                
                المطلوب استخراجه:
                1. الموضوع (subject)
                2. المرسل (from)
                3. المستلم (to)
                4. التاريخ (date)
                5. رقم الصادر الخارجي (externalRefNumber)
                6. ملخص تنفيذي (summary)
                7. هل يرتبط بخطاب سابق؟ ابحث في السجلات التالية:
                ${lettersContext}` }
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
                    referenceId: { type: Type.STRING },
                    referencedNumber: { type: Type.STRING }
                },
                required: ["subject", "from", "to"]
            }
        }
    });

    return JSON.parse(response.text || "{}");
}

/**
 * تحليل النوايا والمسارات الاستراتيجية
 */
export async function analyzeStrategicPaths(letter: Letter): Promise<StrategicAnalysis> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const content = letter.body.replace(/<[^>]*>?/gm, ' ');
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `قم بتحليل هذا الخطاب إدارياً واستراتيجياً بكلمات عربية متصلة:\nالموضوع: ${letter.subject}\nالمحتوى: ${content}`,
        config: {
            systemInstruction: `أنت خبير استراتيجيات إداري. ${ARABIC_STRICT_INSTRUCTION} قم بكشف نوايا المرسل الحقيقية، والمخاطر الإدارية المحتملة، واقترح مسارات للتعامل.`,
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
                required: ["sender_intent", "risks", "paths"]
            }
        }
    });

    return JSON.parse(response.text || "{}");
}

/**
 * توليد مسودات الخطابات (توليد ذكي)
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const { isReply, originalContent, objective, sender, receiver, subject, principles } = params;

    const prompt = isReply 
        ? `رد على الخطاب التالي:\nالمحتوى الأصلي: ${originalContent}\nالهدف المطلوب من الرد: ${objective}\nمن: ${sender}\nإلى: ${receiver}\nالموضوع: ${subject}`
        : `أنشئ خطاباً جديداً:\nالموضوع: ${subject}\nالهدف/المحتوى المطلوب: ${objective}\nمن: ${sender}\nإلى: ${receiver}`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            systemInstruction: `أنت خبير صياغة بروتوكولات رسمية. ${ARABIC_STRICT_INSTRUCTION} قدم 3 نسخ (محايدة، حازمة، دبلوماسية) بصيغة HTML غنية. التخصيص: ${principles}`,
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
 * تلخيص الخطاب (موجز المعاملة)
 */
export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص الخطاب بكلمات متصلة:\nالموضوع: ${letter.subject}\nالمحتوى: ${letter.body.replace(/<[^>]*>?/gm, ' ')}`,
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

/**
 * اقتراح مسارات الرد السريع
 */
export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `اقترح 3 مسارات للرد على هذا الخطاب: الموضوع: ${letter.subject}. المحتوى: ${letter.body.replace(/<[^>]*>?/gm, ' ')}`,
        config: {
            systemInstruction: ARABIC_STRICT_INSTRUCTION,
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
                    },
                    required: ["title", "objective", "tone", "type"]
                }
            }
        }
    });
    return JSON.parse(response.text || "[]");
}

/**
 * تنقيح النص عبر الحوار
 */
export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `السياق: ${context}\nالنص الحالي: ${currentBody}\nالتعديل المطلوب: ${userInstruction}`,
        config: { 
            systemInstruction: `أنت مراجع لغوي. ${ARABIC_STRICT_INSTRUCTION} قم بتعديل النص وأرجعه بصيغة HTML وبكلمات متصلة.` 
        }
    });
    return response.text || currentBody;
}

/**
 * تحسين جودة الصياغة
 */
export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `راجع النص التالي واقترح تحسينات: ${text}`,
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

/**
 * متابعة المعاملات المعلقة
 */
export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حدد المعاملات المعلقة: ${JSON.stringify(list)}`,
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

/**
 * البحث السياقي الذكي
 */
export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<any[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

/**
 * تلخيص سلسلة مراسلات كاملة
 */
export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const text = thread.map(l => `${l.date} - ${l.subject}`).join('\n');
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص تاريخ هذه المراسلات في فقرة متصلة: ${text}`
    });
    return response.text || "";
}
