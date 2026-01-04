
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const ai = getAI();
    const content = letter.body.replace(/<[^>]*>?/gm, ' ');
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `أنت مساعد إداري خبير. حلل الخطاب التالي بدقة:
        الموضوع: ${letter.subject}
        المحتوى: ${content}
        
        المطلوب JSON:
        - summary: ملخص تنفيذي مركز (سطرين بكلمات متصلة).
        - keyPoints: قائمة بالفقرات أو النقاط المحددة التي تستوجب الرد أو الإجراء.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: { type: 'STRING' },
                    keyPoints: { type: 'ARRAY', items: { type: 'STRING' } }
                },
                required: ["summary", "keyPoints"]
            }
        }
    });

    try {
        return JSON.parse(response.text || "{}");
    } catch (e) {
        return { summary: "تعذر تحليل المحتوى حالياً.", keyPoints: [] };
    }
}

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
    `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", ExtRef: "${l.externalRefNumber || ''}", Subject: "${l.subject}", Date: "${l.date}"`
  ).join('\n');

  const systemInstruction = `أنت خبير لغوي وإداري عربي متخصص في استخلاص البيانات من الوثائق الرسمية.
  **قواعد ذهبية:** كلمات عربية متصلة تماماً (لا تقطع الحروف). استخلص (الموضوع، المرسل، المستلم، التاريخ، رقم الصادر، التصنيف، الأولوية). طابق مع السياق: ${lettersContext}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
        parts: [
            { text: `حلل صورة الخطاب المرفقة واستخرج البيانات بصيغة JSON.` },
            { inlineData: { mimeType, data: base64Image } }
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
            },
            required: ["subject", "from", "to", "date"]
        }
    }
  });

  return JSON.parse(response.text || "{}") as ExtractedLetterDetails;
}

export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const ai = getAI();
    const content = letter.summary || letter.body.replace(/<[^>]*>?/gm, ' ');
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `أنت مستشار إداري. اقترح 3 مسارات احترافية للرد على: ${letter.subject}. المحتوى: ${content}. اكتب بكلمات متصلة.`,
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

export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const ai = getAI();
    const prompt = `الخطاب الحالي بصيغة HTML: ${currentBody}
    
    السياق المرجعي: ${context}
    تعليمات المستخدم للتعديل: ${userInstruction}
    
    المطلوب: قم بتعديل نص الخطاب بناءً على التعليمات فقط، وأعد النص الجديد كاملاً بصيغة HTML مبسطة بكلمات عربية متصلة تماماً. حافظ على الطابع الرسمي.`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { temperature: 0.3 }
    });
    return response.text || currentBody;
}

export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `راجع النص وقدم اقتراحات تحسين (كلمات متصلة):\n\n${text}`,
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

export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = getAI();
    const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}`).join('\n');
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص السلسلة بكلمات متصلة:\n\n${threadText}`,
        config: { temperature: 0.2 }
    });
    return response.text || "";
}

export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = getAI();
    const summaries = letters.map(l => ({ id: l.id, subject: l.subject }));
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حدد ما يحتاج متابعة عاجلة: ${JSON.stringify(summaries)}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        letterId: { type: 'STRING' },
                        summary: { type: 'STRING' }
                    }
                }
            }
        }
    });
    return JSON.parse(response.text || "[]");
}

export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<any[]> {
    const ai = getAI();
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `ابحث سياقياً عن "${query}" في: ${JSON.stringify(list)}`,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "[]");
}

export async function generateLetterVariations(context: any) {
    const ai = getAI();
    const systemInstruction = `أنت خبير صياغة إدارية. كلمات متصلة. 3 مسودات HTML. الأسلوب: ${context.principles}`;
    const prompt = context.isReply 
        ? `رد على: ${context.originalContent}. التوجيه: ${context.objective}. من ${context.sender} إلى ${context.receiver}.`
        : `إنشاء خطاب: ${context.subject}. المحتوى: ${context.objective}.`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    analysis: { type: 'OBJECT', properties: { strategic_feedback: { type: 'ARRAY', items: { type: 'STRING' } } } },
                    variations: {
                        type: 'OBJECT',
                        properties: { 
                            neutral: { type: 'STRING' }, 
                            strict: { type: 'STRING' }, 
                            diplomatic: { type: 'STRING' } 
                        }
                    }
                }
            }
        }
    });
    return JSON.parse(response.text || "{}");
}
