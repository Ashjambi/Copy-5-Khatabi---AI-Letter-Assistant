
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone } from "../types";

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
  file: File,
  departments: string[],
  letterTypes: string[],
  priorityLevels: string[],
  confidentialityLevels: string[],
  existingCategories: string[],
  existingLetters: { id: string, subject: string, internalRefNumber?: string, externalRefNumber?: string, date: string }[]
): Promise<ExtractedLetterDetails> {
  
  const lettersContext = existingLetters.slice(0, 5).map(l => 
    `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", Subject: "${l.subject}"`
  ).join('\n');

  try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('lettersContext', lettersContext);

      const response = await fetch('/api/ocr', {
          method: 'POST',
          body: formData
      });

      const responseText = await response.text();

      if (!response.ok) {
          // إظهار الخطأ التقني المفصل القادم من Cloudflare مباشرة
          console.error("DEBUG_LOG_FROM_SERVER:", responseText);
          throw new Error(responseText || "تعذر تحليل المستند.");
      }

      try {
          return JSON.parse(responseText) as ExtractedLetterDetails;
      } catch (jsonErr) {
          throw new Error(`JSON_PARSE_ERROR: ${responseText.substring(0, 100)}`);
      }
      
  } catch (error: any) {
      console.error("OCR Final Catch:", error);
      // إرجاع نص الخطأ كما هو للمستخدم ليراه بوضوح
      throw new Error(error.message);
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

export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<any[]> {
    const ai = getAI();
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `ابحث عن "${query}" سياقياً في: ${JSON.stringify(list)}`,
            config: {
                responseMimeType: "application/json"
            }
        });
        return JSON.parse(response.text || "[]");
    } catch (error) {
        return [];
    }
}
