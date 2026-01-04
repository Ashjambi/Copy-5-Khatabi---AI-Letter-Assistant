
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, SmartSearchResult, LetterVariations } from "../types";

/**
 * استخلاص البيانات من وثائق PDF أو الصور (OCR الذكي)
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
  // تهيئة العميل داخل الدالة لضمان استخدام المفتاح من البيئة في وقت التنفيذ
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const lettersContext = existingLetters.map(l => 
    `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", ExtRef: "${l.externalRefNumber || ''}", Subject: "${l.subject}"`
  ).join('\n');

  const systemInstruction = `أنت خبير أرشفة إداري متخصص. استخلص البيانات من الوثيقة المرفقة (سواء كانت PDF أو صورة) بصيغة JSON.
  
  **قواعد أساسية:**
  1. يجب أن تكون الكلمات العربية متصلة تماماً (مثلاً: "الموضوع" وليس "ا ل م و ض و ع").
  2. استخرج البيانات بدقة: (الموضوع، المرسل، المستلم، التاريخ، رقم المرجع الخارجي).
  3. طابق المعاملة مع السياق التالي إن وجد صلة:
  ${lettersContext}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType || "application/pdf", data: base64Data } },
          { text: "حلل الوثيقة المرفقة واستخرج البيانات المطلوبة بصيغة JSON. إذا كانت المعاملة إلحاقية، حدد referenceId." }
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
            referenceId: { type: Type.STRING }
          },
          required: ["subject", "from", "to"]
        }
      }
    });

    return JSON.parse(response.text || "{}") as ExtractedLetterDetails;
  } catch (e: any) {
    console.error("AI OCR Error:", e);
    throw new Error(e.message || "فشل في تحليل الوثيقة ذكياً.");
  }
}

/**
 * تحليل متن الخطاب لاستخراج ملخص تنفيذي ونقاط العمل
 */
export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const content = letter.body.replace(/<[^>]*>?/gm, ' ');
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `حلل الخطاب واستخرج ملخصاً ونقاط العمل بكلمات متصلة:\n\nالموضوع: ${letter.subject}\nالمحتوى: ${content}`,
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
 * توليد مسارات رد ذكية
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
        return JSON.parse(response.text || "[]");
    } catch (e) {
        return [];
    }
}

/**
 * تنقيح نص الخطاب عبر الدردشة
 */
export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `الخطاب الحالي: ${currentBody}\nالسياق: ${context}\nتعليمات المستخدم: ${userInstruction}\nالمطلوب: تعديل النص وإرجاعه بتنسيق HTML وبكلمات عربية متصلة تماماً.`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { temperature: 0.3 }
    });
    return response.text || currentBody;
}

/**
 * تحسين الصياغة اللغوية والإدارية
 */
export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

/**
 * توليد تنويعات الخطاب
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

    const systemInstruction = `أنت خبير صياغة إداري. الكلمات العربية متصلة دائماً.
    المطلوب: توليد 3 نسخ (محايدة، حازمة، دبلوماسية) بصيغة HTML.
    الأسلوب المفضل: ${principles}`;

    const prompt = isReply 
        ? `رد على: ${originalContent}. الهدف: ${objective}. من: ${sender} إلى: ${receiver}. الموضوع: ${subject}`
        : `خطاب جديد: ${subject}. المحتوى: ${objective}. من: ${sender} إلى: ${receiver}`;

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

export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}`).join('\n');
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص سلسلة المراسلات هذه في فقرة واحدة بكلمات متصلة:\n\n${threadText}`,
        config: { temperature: 0.2 }
    });
    return response.text || "";
}

export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
