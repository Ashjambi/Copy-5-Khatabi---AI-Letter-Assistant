
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, SmartSearchResult } from "../types";

/**
 * الحصول على نسخة المحرك.
 * تلتزم الوظيفة باستخدام process.env.API_KEY كمتغير بيئة وحيد ومعتمد.
 */
const getAI = () => {
    const apiKey = process.env.API_KEY;
    return new GoogleGenAI({ apiKey: apiKey || "" });
};

const ARABIC_STRICT_CONNECTED_SCRIPT = `
قاعدة لغوية قطعية (Arabic Connectivity):
يجب أن تكون جميع النصوص العربية بكلمات متصلة وحروف طبيعية تماماً. 
يُمنع منعاً باتاً فصل الحروف (مثال: اكتب "المدير" وليس "ا ل م د ي ر").
استخدم صياغة إدارية رسمية رصينة.
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
  
  // تقليل السياق لأحدث 30 معاملة لتسريع المعالجة وتقليل حجم الطلب
  const lettersContext = existingLetters.slice(0, 30).map(l => 
    `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", Ext: "${l.externalRefNumber || ''}", Subject: "${l.subject}"`
  ).join('\n');

  const systemInstruction = `أنت خبير أرشفة إداري متخصص. مهمتك استخراج البيانات من الوثيقة المرفقة بدقة JSON.
  ${ARABIC_STRICT_CONNECTED_SCRIPT}
  سياق المعاملات السابقة للمطابقة:
  ${lettersContext}`;

  try {
      // تنظيف الـ Base64 من أي فراغات ناتجة عن التشفير
      const cleanBase64 = base64Image.replace(/\s/g, '');

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
            parts: [
                { inlineData: { mimeType, data: cleanBase64 } },
                { text: `حلل الوثيقة المرفقة واستخرج البيانات التالية بصيغة JSON: الموضوع، المرسل، المستلم، التاريخ، ورقم الصادر الخارجي. إذا كانت الوثيقة مرتبطة بمعاملة سابقة من السياق، فقم بتحديد الـ referenceId.` }
            ]
        },
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    subject: { type: Type.STRING, description: "عنوان المعاملة" },
                    from: { type: Type.STRING, description: "جهة الإرسال" },
                    to: { type: Type.STRING, description: "الجهة الموجه إليها" },
                    date: { type: Type.STRING, description: "تاريخ المستند" },
                    externalRefNumber: { type: Type.STRING, description: "رقم الصادر الخارجي إن وجد" },
                    summary: { type: Type.STRING, description: "ملخص الإجراء المطلوب" },
                    category: { type: Type.STRING, description: "التصنيف المقترح" },
                    referenceId: { type: Type.STRING, description: "ID المعاملة المرتبطة من السياق" }
                },
                required: ["subject", "from", "to"]
            }
        }
      });

      const result = JSON.parse(response.text || "{}");
      return result as ExtractedLetterDetails;
  } catch (error) {
      console.error("Gemini OCR Error:", error);
      throw new Error("فشل الذكاء الاصطناعي في تحليل الوثيقة. تأكد من وضوح الملف وصحة مفتاح الوصول.");
  }
}

export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const ai = getAI();
    const content = letter.summary || letter.body.replace(/<[^>]*>?/gm, ' ');
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `اقترح 3 ردود إدارية ذكية لهذا الخطاب: ${letter.subject}. المحتوى: ${content}`,
            config: {
                systemInstruction: `أنت مستشار إداري. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
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
            contents: `حسن الصياغة التالية إدارياً: ${text}`,
            config: {
                systemInstruction: `أنت مدقق لغوي إداري. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
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
        console.error("Enhancement Error:", error);
        return [];
    }
}

export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = getAI();
    const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}`).join('\n');

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `لخص هذه السلسلة بكلمات متصلة: ${threadText}`,
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
            contents: `حدد المعاملات التي تحتاج متابعة: ${JSON.stringify(summaries)}`,
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
