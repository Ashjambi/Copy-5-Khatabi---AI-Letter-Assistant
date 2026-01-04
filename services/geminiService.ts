
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, LetterVariations } from "../types";

// Helper to initialize AI client with the required environment variable
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * ميزة خارج الصندوق: تحليل استراتيجي للموقف قبل الرد
 */
export async function analyzeStrategicPaths(letter: Letter): Promise<{
    situation_analysis: string;
    power_balance: string;
    strategies: { id: string, title: string, impact: string, logic: string, suggested_objective: string }[]
}> {
    const ai = getAI();
    // Use system instruction and response schema for structured strategic analysis
    const systemInstruction = "أنت خبير استراتيجيات إدارية عربي. يجب أن تكون الكلمات العربية متصلة تماماً (مثل: 'الموضوع' وليس 'ا ل م و ض و ع'). حلل الخطاب الوارد المرفق وحدد: 1. ميزان القوة (صالحنا/صالحهم) 2. النقاط الحرجة 3. ثلاث استراتيجيات رد (دبلوماسية، حازمة، تعاونية).";
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `الموضوع: ${letter.subject}\nمن: ${letter.from}\nالمحتوى: ${letter.body.replace(/<[^>]*>?/gm, ' ')}`,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    situation_analysis: { type: Type.STRING, description: "تحليل دقيق للموقف الحالي" },
                    power_balance: { type: Type.STRING, description: "وصف لميزان القوة الإداري" },
                    strategies: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                title: { type: Type.STRING, description: "اسم الاستراتيجية" },
                                impact: { type: Type.STRING, description: "النتيجة المتوقعة لهذا الرد" },
                                logic: { type: Type.STRING, description: "المنطق خلف هذا المسار" },
                                suggested_objective: { type: Type.STRING }
                            }
                        }
                    }
                },
                required: ["situation_analysis", "strategies"]
            }
        }
    });
    return JSON.parse(response.text || "{}");
}

/**
 * توليد نسخ مختلفة من الخطاب بناءً على نبرات مختلفة
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
    const systemInstruction = `أنت خبير صياغة إداري عربي. الكلمات العربية متصلة دائماً. المطلوب توليد 3 نسخ (محايدة، حازمة، دبلوماسية) بتنسيق HTML. الاستراتيجية المتبعة: ${strategy_logic || 'رسمية'}`;

    const prompt = isReply 
        ? `الخطاب الوارد: ${originalContent}\nالهدف من الرد: ${objective}\nمن: ${sender} إلى: ${receiver}\nالموضوع: ${subject}`
        : `إنشاء خطاب جديد: ${subject}\nالمحتوى المطلوب: ${objective}\nمن: ${sender} إلى: ${receiver}`;

    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
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
                        properties: {
                            neutral: { type: Type.STRING },
                            strict: { type: Type.STRING },
                            diplomatic: { type: Type.STRING }
                        },
                        required: ["neutral", "strict", "diplomatic"]
                    }
                },
                required: ["analysis", "variations"]
            }
        }
    });
    return JSON.parse(response.text || "{}");
}

/**
 * تنقيح نص الخطاب عبر واجهة تشبه الدردشة
 */
export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `النص الحالي: ${currentBody}\nالسياق: ${context}\nالتعديل المطلوب: ${userInstruction}`,
        config: { systemInstruction: "أنت خبير صياغة. عدل النص الموفر لغوياً وإدارياً مع إبقاء الكلمات العربية متصلة." }
    });
    return response.text || currentBody;
}

/**
 * استخراج تفاصيل الخطاب من صورة أو PDF عبر OCR ذكي
 */
export async function extractDetailsFromLetterImage(
  base64Data: string,
  mimeType: string,
  departments: string[],
  letterTypes: string[],
  priorityLevels: string[],
  confidentialityLevels: string[],
  existingCategories: string[],
  existingLetters: { id: string, subject: string, internalRefNumber?: string, externalRefNumber?: string, date: string }[]
): Promise<ExtractedLetterDetails> {
  const ai = getAI();
  const lettersContext = existingLetters.map(l => `- Ref: "${l.internalRefNumber || ''}", Subject: "${l.subject}"`).join('\n');
  const systemInstruction = `أنت خبير أرشفة إداري. استخرج البيانات بكلمات عربية متصلة تماماً وبصيغة JSON. طابق الخطاب مع السجلات الموجودة إذا كان هناك إشارة لخطاب سابق: ${lettersContext}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
        parts: [
            { text: "حلل صورة الخطاب المرفقة واستخرج البيانات." },
            { inlineData: { data: base64Data, mimeType: mimeType || "image/jpeg" } }
        ]
    },
    config: {
        systemInstruction,
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
            }
        }
    }
  });
  return JSON.parse(response.text || "{}");
}

/**
 * توليد موجز سريع للخطاب ونقاط العمل الأساسية
 */
export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حلل الخطاب التالي واستخرج ملخصاً ونقاط العمل بكلمات متصلة:\n\nالموضوع: ${letter.subject}\nالمحتوى: ${letter.body.replace(/<[^>]*>?/gm, ' ')}`,
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
 * تحسين وتدقيق نص الخطاب لغوياً وإدارياً
 */
export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `راجع النص التالي وقدم اقتراحات لتحسين صياغته الإدارية (مع إبقاء الكلمات متصلة):\n\n${text}`,
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
 * @FIX: Added missing generateSmartReplies function to handle smart reply suggestions in LetterDetails.tsx
 */
export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const ai = getAI();
    const content = letter.summary || letter.body.replace(/<[^>]*>?/gm, ' ');
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `اقترح 3 مسارات احترافية للرد على هذا الخطاب (الموضوع: ${letter.subject}). المحتوى: ${content}. اكتب الردود بلغة عربية متصلة وسليمة تماماً.`,
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
}

/**
 * @FIX: Added missing summarizeCorrespondenceThread function to summarize letter threads in LetterDetails.tsx
 */
export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = getAI();
    const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}\n${l.body.replace(/<[^>]*>?/gm, ' ')}`).join('\n---\n');

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص هذه السلسلة من المراسلات في فقرة واحدة بكلمات متصلة توضح تسلسل الأحداث والوضع الحالي:\n\n${threadText}`,
    });
    return response.text || "";
}

/**
 * @FIX: Added missing getFollowUpSummary function to analyze pending items in FollowUpAssistant.tsx
 */
export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = getAI();
    const summaries = letters.map(l => ({ id: l.id, subject: l.subject, status: l.status, date: l.date }));
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `من القائمة التالية للمراسلات، حدد المعاملات التي قد تحتاج متابعة عاجلة (مثل طلبات قديمة لم يتم الرد عليها). JSON:\n\n${JSON.stringify(summaries)}`,
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
}

/**
 * @FIX: Added missing searchLettersSmartly function to enable context-aware search in Archive.tsx
 */
export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<any[]> {
    const ai = getAI();
    const list = letters.map(l => ({ id: l.id, subject: l.subject, summary: l.summary || l.body.substring(0, 100).replace(/<[^>]*>?/gm, ' ') }));
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `ابحث سياقياً ومعنوياً عن "${query}" في قائمة المراسلات التالية. حدد المعاملات المرتبطة مع ذكر سبب الارتباط ونسبة التطابق. JSON:\n\n${JSON.stringify(list)}`,
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
    return JSON.parse(response.text || "[]");
}
