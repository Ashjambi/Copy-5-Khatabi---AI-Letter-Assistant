
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, SmartSearchResult } from "../types";

/**
 * وظيفة الحصول على نسخة من محرك الذكاء الاصطناعي.
 * تلتزم باستخدام process.env.API_KEY حصرياً كمتغير بيئة للنظام.
 */
const getAI = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("فشل الوصول إلى مفتاح API. تأكد من إعداده في متغيرات البيئة باسم API_KEY.");
    }
    return new GoogleGenAI({ apiKey: apiKey || "" });
};

/**
 * قاعدة لغوية صارمة لضمان جودة النص العربي المولد.
 */
const ARABIC_STRICT_CONNECTED_SCRIPT = `
قاعدة لغوية قطعية (Strict Arabic Connectivity):
يجب أن تكون جميع النصوص العربية بكلمات متصلة وحروف طبيعية تماماً. 
يُمنع منعاً باتاً فصل الحروف أو كتابتها بشكل متقطع (مثال: اكتب "خطاب" وليس "خ ط ا ب"). 
أي مخرج بحروف مقطعة سيعتبر فشلاً في المعالجة. استخدم لغة عربية إدارية رصينة ومترابطة.
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
  
  const lettersContext = existingLetters.map(l => 
    `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", Subject: "${l.subject}"`
  ).join('\n');

  const systemInstruction = `أنت خبيرOCR إداري متخصص في الوثائق الحكومية والشركات. استخلص البيانات من الصورة بدقة عالية.
  ${ARABIC_STRICT_CONNECTED_SCRIPT}
  السياق المرجعي للمعاملات السابقة:
  ${lettersContext}`;

  try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
            parts: [
                { text: `حلل الصورة واستخرج البيانات بدقة بصيغة JSON. تأكد من سلامة اللغة العربية.` },
                { inlineData: { mimeType, data: base64Image.replace(/\s/g, '') } }
            ]
        },
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    subject: { type: Type.STRING, description: "موضوع الخطاب" },
                    from: { type: Type.STRING, description: "جهة الإرسال" },
                    to: { type: Type.STRING, description: "جهة الاستلام" },
                    date: { type: Type.STRING, description: "تاريخ الخطاب" },
                    externalRefNumber: { type: Type.STRING, description: "رقم الصادر الخارجي" },
                    summary: { type: Type.STRING, description: "ملخص المحتوى" },
                    category: { type: Type.STRING, description: "التصنيف المقترح" },
                    referenceId: { type: Type.STRING, description: "معرف الخطاب المرتبط من السياق" }
                },
                required: ["subject", "from", "to"]
            }
        }
      });

      return JSON.parse(response.text || "{}") as ExtractedLetterDetails;
  } catch (error) {
      console.error("Extraction error:", error);
      throw error;
  }
}

export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const ai = getAI();
    const content = letter.summary || letter.body.replace(/<[^>]*>?/gm, ' ');
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `اقترح 3 مسارات استراتيجية للرد على هذا الخطاب: ${letter.subject}. المحتوى: ${content}.`,
            config: {
                systemInstruction: `أنت مستشار إداري رفيع المستوى. قدم اقتراحات رد ذكية وقانونية. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
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
        console.error("Smart replies error:", error);
        return [];
    }
}

export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = getAI();
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `راجع النص التالي وقدم اقتراحات احترافية لتحسين صياغته الإدارية واللغوية:\n\n${text}`,
            config: {
                systemInstruction: `أنت مدقق لغوي إداري خبير. ركز على قوة العبارات والوضوح. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
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
        console.error("Enhancement error:", error);
        return [];
    }
}

export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = getAI();
    const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject} (${l.date})`).join('\n');

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `لخص هذه السلسلة من المراسلات في فقرة واحدة شاملة توضح جوهر المعاملة وما تم التوصل إليه:\n\n${threadText}`,
            config: { 
                systemInstruction: `أنت خبير تلخيص معاملات إدارية. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
                temperature: 0.3
            }
        });
        return response.text || "";
    } catch (error) {
        console.error("Summarization error:", error);
        return "تعذر تلخيص السلسلة حالياً.";
    }
}

export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = getAI();
    const summaries = letters.map(l => ({ id: l.id, subject: l.subject, status: l.status, date: l.date }));
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `حلل هذه المعاملات وحدد ما يحتاج منها إلى متابعة فورية مع ذكر السبب باختصار:\n\n${JSON.stringify(summaries)}`,
            config: {
                systemInstruction: `أنت مساعد متابعة إداري ذكي. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
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
        console.error("Follow-up error:", error);
        return [];
    }
}

export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<SmartSearchResult[]> {
    const ai = getAI();
    const list = letters.map(l => ({ id: l.id, subject: l.subject, summary: l.summary || "" }));
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `ابحث سياقياً ومعنوياً عن "${query}" في هذه القائمة:\n\n${JSON.stringify(list)}`,
            config: {
                systemInstruction: `أنت خبير بحث سياقي. حلل النية وراء البحث وجد النتائج الأكثر صلة حتى لو لم تتطابق الكلمات حرفياً. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
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
        console.error("Smart search error:", error);
        return [];
    }
}
