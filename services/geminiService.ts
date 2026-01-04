
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, LetterVariations } from "../types";

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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const lettersContext = existingLetters.map(l => 
    `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", Subject: "${l.subject}"`
  ).join('\n');

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType || "image/jpeg" } },
          { 
            text: `أنت خبير أرشفة إداري. استخرج البيانات من الوثيقة المرفقة بكلمات عربية متصلة تماماً.
            المطلوب JSON يحتوي على:
            - subject: موضوع الخطاب بدقة
            - from: الجهة المرسلة
            - to: القسم المستلم المقترح
            - date: التاريخ المستخرج (YYYY-MM-DD)
            - externalRefNumber: رقم الصادر الخارجي
            - summary: ملخص تنفيذي قصير (سطر واحد)
            - referenceId: معرف المعاملة المرتبطة من القائمة التالية إن وجد صلة: ${lettersContext}` 
          }
        ]
      }
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
          summary: { type: Type.STRING },
          category: { type: Type.STRING },
          referenceId: { type: Type.STRING }
        },
        required: ["subject", "from", "to"]
      }
    }
  });

  return JSON.parse(response.text || "{}") as ExtractedLetterDetails;
}

/**
 * توليد تنويعات الخطاب (محايدة، حازمة، دبلوماسية)
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
        ? `رد استراتيجي على خطاب سابق. السياق: ${originalContent}. الهدف الحالي: ${objective}. من: ${sender} إلى: ${receiver}. الموضوع: ${subject}.`
        : `إنشاء خطاب جديد. الموضوع: ${subject}. المحتوى المطلوب: ${objective}. من: ${sender} إلى: ${receiver}.`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            systemInstruction: `أنت خبير صياغة إداري. الكلمات العربية يجب أن تكون متصلة. 
            المطلوب توليد 3 نسخ بصيغة HTML (neutral, strict, diplomatic).
            الأسلوب المفضل: ${principles}`,
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
 * توليد مسارات رد استراتيجية (Smart Replies)
 */
export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const content = letter.summary || letter.body.replace(/<[^>]*>?/gm, ' ');
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حلل الخطاب التالي واقترح 3 مسارات رد مهنية: 
        الموضوع: ${letter.subject}
        المحتوى: ${content}
        
        ملاحظة هامة: يجب أن تكون قيمة 'tone' هي إحدى القيم التالية حصراً: ['رسمية صارمة', 'محايدة', 'دبلوماسية', 'تعاونية'].`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: "عنوان قصير للمسار (مثال: موافقة مشروطة)" },
                        objective: { type: Type.STRING, description: "وصف مفصل لغرض الرد ليستخدمه النظام في الصياغة" },
                        tone: { type: Type.STRING, description: "النبرة المطلوبة (يجب أن تطابق الـ Enum)" },
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
 * تحليل محتوى الخطاب لاستخراج النقاط الرئيسية والملخص
 */
export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const content = letter.body.replace(/<[^>]*>?/gm, ' ');
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حلل الخطاب واستخرج ملخصاً ونقاط العمل بكلمات عربية متصلة:\n\nالموضوع: ${letter.subject}\nالمحتوى: ${content}`,
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
 * تحسين الصياغة الإدارية
 */
export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `راجع النص التالي وقدم اقتراحات لتحسين صياغته الإدارية العربية:\n\n${text}`,
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
 * تلخيص سلسلة مراسلات
 */
export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}`).join('\n');
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص سلسلة المراسلات هذه في فقرة واحدة بكلمات متصلة:\n\n${threadText}`,
    });
    return response.text || "تعذر التلخيص حالياً.";
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
    });
    return response.text || currentBody;
}

/**
 * البحث الذكي سياقياً
 */
export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<any[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `ابحث سياقياً عن "${query}" في القائمة التالية وأعد النتائج المرتبطة بصيغة JSON:\n\n${JSON.stringify(list)}`,
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

/**
 * ملخص المتابعة (المعاملات المعلقة)
 */
export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const summaries = letters.map(l => ({ id: l.id, subject: l.subject }));
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حدد المعاملات التي تحتاج متابعة عاجلة من القائمة بصيغة JSON:\n\n${JSON.stringify(summaries)}`,
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
