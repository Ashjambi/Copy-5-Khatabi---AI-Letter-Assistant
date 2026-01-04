
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, SmartSearchResult } from "../types";

/**
 * وظيفة تهيئة المحرك للخدمات المتبقية في الواجهة الأمامية.
 */
const getAI = () => {
    const apiKey = process.env.API_KEY;
    return new GoogleGenAI({ apiKey: apiKey || "" });
};

const ARABIC_STRICT_CONNECTED_SCRIPT = `
قاعدة لغوية قطعية (Arabic Text Connectivity):
يجب أن تكون جميع المخرجات باللغة العربية بكلمات متصلة وحروف طبيعية تماماً.
يُمنع منعاً باتاً تقطيع الحروف (مثل: اكتب "المعاملة" وليس "ا ل م ع ا م ل ة").
`;

export async function extractDetailsFromLetterImage(
  file: File, // تم التغيير لاستقبال ملف File مباشرة
  departments: string[],
  letterTypes: string[],
  priorityLevels: string[],
  confidentialityLevels: string[],
  existingCategories: string[],
  existingLetters: { id: string, subject: string, internalRefNumber?: string, externalRefNumber?: string, date: string }[]
): Promise<ExtractedLetterDetails> {
  
  // تقليل السياق لأحدث 5 معاملات فقط لضمان بقاء الطلب خفيفاً
  const lettersContext = existingLetters.slice(0, 5).map(l => 
    `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", Subject: "${l.subject}"`
  ).join('\n');

  try {
      // إرسال الملف عبر FormData لضمان معالجة Binary سليمة في Cloudflare
      const formData = new FormData();
      formData.append('file', file);
      formData.append('lettersContext', lettersContext);

      const response = await fetch('/api/ocr', {
          method: 'POST',
          body: formData
      });

      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "فشل تحليل المستند سحابياً.");
      }

      const result = await response.json();
      return result as ExtractedLetterDetails;
      
  } catch (error: any) {
      console.error("OCR Fetch Proxy Error:", error);
      throw new Error(error.message || "تأكد من إعدادات Cloudflare وصحة مفتاح الـ API.");
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
