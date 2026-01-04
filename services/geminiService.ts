
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, SmartSearchResult } from "../types";

/**
 * تحليل متن الخطاب لاستخراج ملخص تنفيذي ونقاط العمل
 */
export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const content = letter.body.replace(/<[^>]*>?/gm, ' ');
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `أنت مساعد إداري خبير في تحليل المراسلات الرسمية العربية. 
            المهمة: قم بتحليل الخطاب التالي واستخرج ملخصاً تنفيذياً ونقاط العمل الجوهرية بكلمات عربية متصلة تماماً.
            
            الخطاب:
            الموضوع: ${letter.subject}
            المحتوى: ${content}
            
            أعد النتيجة بصيغة JSON:
            - summary: ملخص سطرين.
            - keyPoints: مصفوفة نصوص للنقاط الهامة.`,
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
    } catch (e) {
        return { summary: "تعذر تحليل المحتوى حالياً.", keyPoints: [] };
    }
}

/**
 * استخلاص البيانات من صور الخطابات (OCR الذكي)
 */
export async function extractDetailsFromLetterImage(
  base64Image: string,
  mimeType: string,
  departments: string[],
  letterTypes: string[],
  priorityLevels: string[],
  confidentialityLevels: string[],
  existingCategories: string[],
  existingLetters: { id: string, subject: string, internalRefNumber?: string, externalRefNumber?: string, date: string }[]
): Promise<ExtractedLetterDetails> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const lettersContext = existingLetters.map(l => 
    `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", Subject: "${l.subject}"`
  ).join('\n');

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
        parts: [
            { text: `أنت خبير أرشفة رقمية. استخلص البيانات من الوثيقة المرفقة بصيغة JSON. الكلمات العربية متصلة تماماً.
            السياق المرجعي:
            ${lettersContext}` },
            { inlineData: { mimeType, data: base64Image } }
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
                category: { type: Type.STRING },
                priority: { type: Type.STRING },
                confidentiality: { type: Type.STRING },
                referenceId: { type: Type.STRING },
                referencedNumber: { type: Type.STRING }
            },
            required: ["subject", "from", "to", "date"]
        }
    }
  });

  return JSON.parse(response.text || "{}") as ExtractedLetterDetails;
}

/**
 * اقتراح مسارات رد ذكية
 */
export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const content = letter.summary || letter.body.replace(/<[^>]*>?/gm, ' ');
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `اقترح 3 مسارات استراتيجية للرد على هذا الخطاب: "${letter.subject}". المحتوى: ${content}. أجب بصيغة JSON بكلمات متصلة.`,
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
                        },
                        required: ["title", "objective", "tone", "type"]
                    }
                }
            }
        });
        
        return JSON.parse(response.text || "[]") as SmartReply[];
    } catch (e) {
        return [];
    }
}

/**
 * تنقيح نص الخطاب عبر الدردشة
 */
export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `الخطاب الحالي: ${currentBody}
    السياق: ${context}
    تعليمات المستخدم: ${userInstruction}
    المطلوب: تعديل النص بناءً على التعليمات وإرجاع النص كاملاً بصيغة HTML بسيطة بكلمات عربية متصلة.`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { temperature: 0.3 }
    });
    
    return response.text || currentBody;
}

/**
 * تحسين الصياغة الإدارية
 */
export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `راجع النص التالي وقدم اقتراحات لتحسين صياغته الإدارية بكلمات متصلة:\n\n${text}`,
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
                        },
                        required: ["original_part", "suggested_improvement", "reason"]
                    }
                }
            }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) {
        return [];
    }
}

/**
 * تلخيص سلسلة مراسلات
 */
export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}`).join('\n');
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص سلسلة المراسلات هذه بكلمات عربية متصلة:\n\n${threadText}`,
        config: { temperature: 0.2 }
    });
    return response.text || "";
}

/**
 * تحليل المعاملات التي تحتاج متابعة
 */
export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const summaries = letters.map(l => ({ id: l.id, subject: l.subject }));
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `حدد المعاملات التي تحتاج متابعة عاجلة:\n\n${JSON.stringify(summaries)}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            letterId: { type: Type.STRING },
                            summary: { type: Type.STRING }
                        },
                        required: ["letterId", "summary"]
                    }
                }
            }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) {
        return [];
    }
}

/**
 * توليد مسودات الخطاب (3 خيارات)
 */
export async function generateLetterVariations(context: any) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const systemInstruction = `أنت خبير صياغة مراسلات إدارية رسمية. كلمات متصلة الحروف تماماً. الأسلوب: ${context.principles}`;

    const prompt = context.isReply 
        ? `رد على خطاب: ${context.originalContent}. الهدف: ${context.objective}. من ${context.sender} إلى ${context.receiver}. الموضوع: ${context.subject}`
        : `إنشاء خطاب جديد: ${context.subject}. المحتوى: ${context.objective}. المرسل: ${context.sender} | المستلم: ${context.receiver}`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    analysis: { type: Type.OBJECT, properties: { strategic_feedback: { type: Type.ARRAY, items: { type: Type.STRING } } } },
                    variations: {
                        type: Type.OBJECT,
                        properties: { neutral: { type: Type.STRING }, strict: { type: Type.STRING }, diplomatic: { type: Type.STRING } },
                        required: ["neutral", "strict", "diplomatic"]
                    }
                }
            }
        }
    });
    return JSON.parse(response.text || "{}");
}

/**
 * البحث السياقي الذكي
 */
export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<SmartSearchResult[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `ابحث عن المعاملات المرتبطة بـ "${query}" في: ${JSON.stringify(list)}. أرجع النتائج بصيغة JSON.`,
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
                    },
                    required: ["letterId", "relevanceReason", "confidenceScore"]
                }
            }
        }
    });

    try {
        return JSON.parse(response.text || "[]");
    } catch (e) {
        return [];
    }
}
