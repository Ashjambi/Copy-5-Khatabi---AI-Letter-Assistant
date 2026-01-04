
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, SmartSearchResult } from "../types";

/**
 * وظيفة تهيئة المحرك.
 * تلتزم القواعد باستخدام process.env.API_KEY حصرياً.
 */
const getAI = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("Critical: API_KEY is undefined in process.env");
    }
    return new GoogleGenAI({ apiKey: apiKey || "" });
};

const ARABIC_STRICT_CONNECTED_SCRIPT = `
قاعدة لغوية قطعية (Arabic Text Connectivity):
يجب أن تكون جميع المخرجات باللغة العربية بكلمات متصلة وحروف طبيعية تماماً.
يُمنع منعاً باتاً تقطيع الحروف (مثل: اكتب "المعاملة" وليس "ا ل م ع ا م ل ة").
استخدم لغة إدارية رصينة ومترابطة.
`;

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
  const ai = getAI();
  
  // تقليل السياق لضمان عدم تجاوز حدود حجم الطلب (Payload)
  const lettersContext = existingLetters.slice(0, 15).map(l => 
    `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", Subject: "${l.subject}"`
  ).join('\n');

  const systemInstruction = `أنت مساعد أرشفة إداري ذكي متخصص في استخراج البيانات من الوثائق الرسمية.
  ${ARABIC_STRICT_CONNECTED_SCRIPT}
  سياق المعاملات السابقة للمطابقة:
  ${lettersContext}`;

  try {
      // تنظيف بيانات الـ Base64 من أي محارف غير مرغوبة قد تسبب فشل الطلب
      const sanitizedBase64 = base64Image.replace(/^data:.*,/, "").replace(/\s/g, "");

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
            parts: [
                { inlineData: { mimeType, data: sanitizedBase64 } },
                { text: `حلل هذه الوثيقة واستخرج البيانات التالية بصيغة JSON:
                - subject: موضوع الخطاب
                - from: جهة الإرسال
                - to: جهة الاستلام (القسم)
                - date: التاريخ المذكور في الخطاب
                - externalRefNumber: رقم الصادر الخارجي إن وجد
                - summary: ملخص قصير جداً للمحتوى
                - category: تصنيف مقترح
                - referenceId: معرف المعاملة المرتبطة من السياق إن وجد` }
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
                    referenceId: { type: Type.STRING }
                },
                required: ["subject", "from", "to"]
            }
        }
      });

      if (!response.text) {
          throw new Error("Empty response from Gemini API");
      }

      return JSON.parse(response.text) as ExtractedLetterDetails;
  } catch (error: any) {
      console.error("Gemini OCR Detailed Error:", error);
      // توفير رسالة خطأ أكثر تفصيلاً للمستخدم لمساعدته في تتبع المشكلة
      const errorMsg = error?.message || "";
      if (errorMsg.includes("API key not valid")) {
          throw new Error("مفتاح الـ API غير صالح. يرجى التحقق من إعدادات Cloudflare.");
      } else if (errorMsg.includes("limit")) {
          throw new Error("تم تجاوز حدود الاستخدام للـ API حالياً.");
      }
      throw new Error("حدث خطأ تقني أثناء تحليل الصورة. تأكد من وضوح المستند وحجم الملف.");
  }
}

export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const ai = getAI();
    const content = letter.summary || letter.body.replace(/<[^>]*>?/gm, ' ');
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `اقترح ردوداً إدارية لهذا الخطاب: ${letter.subject}. المحتوى: ${content}`,
            config: {
                systemInstruction: `أنت خبير مراسلات إدارية. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
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
    } catch (error) {
        console.error("Smart Replies Error:", error);
        return [];
    }
}

export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = getAI();
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `راجع هذا النص وقدم تحسينات بكلمات متصلة: ${text}`,
            config: {
                systemInstruction: `أنت مدقق لغوي خبير. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
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
    } catch (error) {
        return [];
    }
}

export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = getAI();
    const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}`).join('\n');
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `لخص هذه السلسلة بفقرة متصلة: ${threadText}`,
            config: { systemInstruction: ARABIC_STRICT_CONNECTED_SCRIPT }
        });
        return response.text || "";
    } catch (error) {
        return "تعذر التلخيص حالياً.";
    }
}

export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = getAI();
    const summaries = letters.map(l => ({ id: l.id, subject: l.subject }));
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `حدد ما يحتاج متابعة عاجلة JSON: ${JSON.stringify(summaries)}`,
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
    } catch (error) {
        return [];
    }
}

export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<SmartSearchResult[]> {
    const ai = getAI();
    const list = letters.map(l => ({ id: l.id, subject: l.subject, summary: l.summary || "" }));
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `ابحث عن "${query}" سياقياً في: ${JSON.stringify(list)}`,
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
    } catch (error) {
        return [];
    }
}
