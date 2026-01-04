import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, SmartSearchResult, LetterVariations } from "../types";

/**
 * استخلاص البيانات من وثائق PDF أو الصور (OCR الذكي)
 * يستخدم gemini-3-flash-preview لدعمه القوي للوثائق العربية
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
  // تهيئة العميل داخل الدالة لضمان استخدام المفتاح المحقون في البيئة
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const lettersContext = existingLetters.map(l => 
    `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", ExtRef: "${l.externalRefNumber || ''}", Subject: "${l.subject}"`
  ).join('\n');

  const systemInstruction = `أنت خبير أرشفة إداري متخصص في الوثائق العربية الرسمية.
  
  **قواعد لغوية قطعية (Arabic Text Integrity):**
  1. يجب أن تكون الكلمات العربية في المخرجات متصلة تماماً وطبيعية (مثال: "الموضوع" وليس "ا ل م و ض و ع").
  2. لا تضع مسافات بين حروف الكلمة الواحدة أبداً.
  3. استخرج البيانات بدقة من المستند المرفق (PDF أو صورة).

  **المطلوب JSON يحتوي على:**
  - subject: موضوع الخطاب
  - from: الجهة المرسلة
  - to: الجهة الموجه إليها
  - date: التاريخ بصيغة YYYY-MM-DD
  - externalRefNumber: رقم القيد الخارجي
  - summary: ملخص تنفيذي قصير
  - referenceId: إذا وجد تطابق مع أحد المعرفات التالية:
  ${lettersContext}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { mimeType: mimeType || "application/pdf", data: base64Data } },
        { text: "حلل الوثيقة المرفقة واستخرج البيانات المطلوبة بصيغة JSON. تأكد من سلامة واتصال الكلمات العربية." }
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
}

/**
 * توليد 3 تنويعات للخطاب بناءً على الهدف والأسلوب
 * يستخدم gemini-3-pro-preview للمهام النصية المعقدة
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

    const systemInstruction = `أنت خبير صياغة إداري عربي. الكلمات العربية متصلة دائماً.
    المطلوب: توليد 3 نسخ (محايدة، حازمة، دبلوماسية) بتنسيق HTML نظيف.
    الأسلوب المكتسب: ${principles}`;

    const prompt = isReply 
        ? `رد استراتيجي على خطاب سابق.
           سياق المرجع: ${originalContent}
           الهدف الحالي: ${objective}
           من: ${sender} إلى: ${receiver}
           الموضوع: ${subject}`
        : `إنشاء خطاب جديد باحترافية.
           الموضوع: ${subject}
           المحتوى المطلوب: ${objective}
           من: ${sender} إلى: ${receiver}`;

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
 * تحليل متن الخطاب لاستخراج ملخص تنفيذي ونقاط العمل
 */
export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const content = letter.body.replace(/<[^>]*>?/gm, ' ');
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `حلل الخطاب واستخرج ملخصاً تنفيذياً ونقاط العمل بكلمات عربية متصلة:\n\nالموضوع: ${letter.subject}\nالمحتوى: ${content}`,
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
                        }
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
 * البحث الذكي سياقياً
 */
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

/**
 * تلخيص سلسلة مراسلات
 */
export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}\n${l.body.replace(/<[^>]*>?/gm, ' ')}`).join('\n---\n');
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص هذه السلسلة في فقرة واحدة بكلمات عربية متصلة:\n\n${threadText}`,
        config: { temperature: 0.2 }
    });
    return response.text || "";
}

/**
 * ملخص المتابعة
 */
export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const summaries = letters.map(l => ({ id: l.id, subject: l.subject }));
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `حدد المعاملات التي تحتاج متابعة عاجلة من القائمة بصيغة JSON بكلمات متصلة:\n\n${JSON.stringify(summaries)}`,
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
