
import { GoogleGenAI, Type } from "@google/genai";
// @FIX: Added LetterVariations to imports from types.ts
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, SmartSearchResult, LetterVariations } from "../types";

/**
 * دالة مساعدة لتهيئة العميل باستخدام المفتاح من البيئة حصراً
 */
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * استخلاص البيانات من صور الخطابات أو ملفات PDF (OCR الذكي)
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
  
  const lettersContext = existingLetters.map(l => 
    `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", ExtRef: "${l.externalRefNumber || ''}", Subject: "${l.subject}"`
  ).join('\n');

  // تعليمات لغوية قصوى لمنع تقطيع الحروف العربية
  const systemInstruction = `أنت خبير أرشفة إداري متخصص في تحليل الوثائق الرسمية العربية.
  
  **قواعد ذهبية:**
  1. يجب أن تكون جميع المخرجات النصية بكلمات عربية متصلة وطبيعية (مثلاً: "خطاب" وليس "خ ط ا ب").
  2. استخلص البيانات بدقة من الوثيقة (سواء كانت صورة أو PDF).
  3. أعد النتيجة بصيغة JSON حصراً.

  **المهام:**
  1. استخرج (الموضوع، المرسل، المستلم، التاريخ، رقم المرجع الخارجي).
  2. طابق المستند مع السجلات التالية إن وجد صلة:
  ${lettersContext}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
        {
            parts: [
                { text: `حلل الوثيقة المرفقة واستخرج البيانات المطلوبة بصيغة JSON. تأكد من سلامة اللغة العربية.` },
                { inlineData: { mimeType, data: base64Data } }
            ]
        }
    ],
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
            },
            required: ["subject", "from", "to"]
        }
    }
  });

  try {
      return JSON.parse(response.text || "{}") as ExtractedLetterDetails;
  } catch (e) {
      console.error("JSON Parsing Error in OCR:", e);
      throw new Error("فشل تحليل بيانات الوثيقة.");
  }
}

/**
 * @FIX: Added missing generateLetterVariations function required by LetterGenerator component
 * توليد 3 تنويعات للخطاب بناءً على الهدف والأسلوب
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

    const systemInstruction = `أنت خبير صياغة إداري متخصص. 
    يجب أن تكون جميع النصوص العربية بكلمات متصلة وطبيعية.
    المهمة: توليد 3 نسخ من الخطاب (محايدة، حازمة، دبلوماسية) بصيغة HTML.
    الأسلوب المفضل بناءً على القواعد المكتسبة: ${principles}`;

    const prompt = isReply 
        ? `رد على الخطاب التالي:
           السياق المرجعي: ${originalContent}
           الهدف من الرد: ${objective}
           من: ${sender} | إلى: ${receiver}
           الموضوع: ${subject}`
        : `أنشئ خطاباً جديداً بالمعطيات التالية:
           الموضوع: ${subject}
           الهدف والمحتوى: ${objective}
           من: ${sender} | إلى: ${receiver}`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
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
                        },
                        required: ["strategic_feedback"]
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
                },
                required: ["analysis", "variations"]
            }
        }
    });

    try {
        return JSON.parse(response.text || "{}");
    } catch (e) {
        console.error("JSON Parsing Error in generateLetterVariations:", e);
        throw new Error("فشل تحليل استجابة الذكاء الاصطناعي.");
    }
}

/**
 * تحليل متن الخطاب لاستخراج ملخص تنفيذي ونقاط العمل
 */
export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const ai = getAI();
    const content = letter.body.replace(/<[^>]*>?/gm, ' ');
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `حلل الخطاب التالي واستخرج ملخصاً تنفيذياً ونقاط العمل بكلمات عربية متصلة:
            الموضوع: ${letter.subject}
            المحتوى: ${content}`,
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

export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const ai = getAI();
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

export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const ai = getAI();
    const prompt = `الخطاب الحالي: ${currentBody}\nالسياق: ${context}\nتعليمات المستخدم: ${userInstruction}\nالمطلوب: تعديل النص وإرجاعه بتنسيق HTML وبكلمات عربية متصلة تماماً.`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { temperature: 0.3 }
    });
    
    return response.text || currentBody;
}

export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = getAI();
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `راجع النص وقدم اقتراحات لتحسين صياغته الإدارية بكلمات متصلة:\n\n${text}`,
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

export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = getAI();
    const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}`).join('\n');
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص سلسلة المراسلات هذه في فقرة واحدة بكلمات متصلة:\n\n${threadText}`,
        config: { temperature: 0.2 }
    });
    return response.text || "";
}

export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = getAI();
    const summaries = letters.map(l => ({ id: l.id, subject: l.subject }));
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `حدد المعاملات التي تحتاج متابعة عاجلة من القائمة:\n\n${JSON.stringify(summaries)}`,
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

export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<SmartSearchResult[]> {
    const ai = getAI();
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `ابحث سياقياً عن "${query}" في القائمة التالية وأعد النتائج المرتبطة بصيغة JSON. القائمة: ${JSON.stringify(list)}`,
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
    } catch (e) {
        return [];
    }
}
