
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, LetterVariations, StrategicAnalysis } from "../types";

const ARABIC_STRICT_INSTRUCTION = "يجب أن تكون جميع النصوص العربية بكلمات متصلة تماماً وطبيعية (مثال: 'الموضوع' وليس 'ا ل م و ض و ع'). يُمنع منعاً باتاً تقطيع الحروف أو وضع مسافات بين حروف الكلمة الواحدة.";

/**
 * تحليل استراتيجي للموقف الإداري
 */
export async function analyzeStrategicPaths(letter: Letter): Promise<StrategicAnalysis> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemInstruction = `أنت خبير استراتيجيات إدارية عربي رفيع المستوى. 
    حلل الخطاب الوارد وقدم تحليلاً استراتيجياً بصيغة JSON.
    ${ARABIC_STRICT_INSTRUCTION}`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حلل الموقف التالي:\nالموضوع: ${letter.subject}\nالمحتوى: ${letter.body.replace(/<[^>]*>?/gm, ' ')}`,
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
 * توليد مسودات الخطاب (باستخدام النسخة Pro لجودة أعلى)
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const { isReply, originalContent, objective, sender, receiver, subject, strategy_logic } = params;

    const systemInstruction = `أنت خبير صياغة بروتوكولية عربية. 
    المطلوب: توليد 3 نسخ (محايدة، حازمة، دبلوماسية) بتنسيق HTML.
    الاستراتيجية المتبعة: ${strategy_logic || 'رسمية'}
    ${ARABIC_STRICT_INSTRUCTION}`;

    const prompt = isReply 
        ? `رد على: ${originalContent}. الهدف: ${objective}. من: ${sender} إلى: ${receiver}. الموضوع: ${subject}`
        : `خطاب جديد: ${subject}. الهدف: ${objective}. من: ${sender} إلى: ${receiver}`;

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
 * تنقيح النص بالحوار
 */
export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `النص الحالي: ${currentBody}\nالسياق: ${context}\nالمطلوب: ${userInstruction}`,
        config: { 
            systemInstruction: `أنت خبير تنقيح لغوي. عدل النص بتنسيق HTML بكلمات متصلة. ${ARABIC_STRICT_INSTRUCTION}` 
        }
    });
    return response.text || currentBody;
}

/**
 * استخلاص بيانات OCR من الصور
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
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
        { parts: [
            { text: `استخرج البيانات من صورة الخطاب بصيغة JSON. ${ARABIC_STRICT_INSTRUCTION}` },
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
                summary: { type: Type.STRING }
            }
        }
    }
  });
  return JSON.parse(response.text || "{}");
}

export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص بكلمات متصلة: ${letter.body.substring(0, 2000)}`,
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `اقترح ردوداً على: ${letter.subject}`,
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

export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حسن لغوياً وإدارياً: ${text}`,
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

export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const threadText = thread.map(l => `${l.from}: ${l.subject}`).join('\n');
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص السلسلة بكلمات متصلة:\n${threadText}`,
    });
    return response.text || "";
}

export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `ابحث سياقياً عن "${query}" في الخطابات.`,
    });
    return [];
}
