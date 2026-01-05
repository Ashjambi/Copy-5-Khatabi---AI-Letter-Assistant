
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, LetterVariations, StrategicAnalysis } from "../types";

/**
 * وظيفة المساعدة لتهيئة العميل باستخدام المفتاح من البيئة
 */
const getAiClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API Key is missing from the environment.");
    }
    return new GoogleGenAI({ apiKey });
};

/**
 * قاعدة لغوية صارمة لمنع تقطيع الحروف العربية في المخرجات
 */
const ARABIC_STRICT_INSTRUCTION = "قاعدة لغوية صارمة: يجب أن تكون جميع المخرجات العربية بكلمات طبيعية متصلة الحروف (مثل: 'خطاب' وليس 'خ ط ا ب'). يُمنع تقطيع الحروف أو وضع مسافات بين حروف الكلمة الواحدة نهائياً. يجب إرجاع النتائج بتنسيق JSON صالح فقط.";

/**
 * تنظيف نصوص JSON المستلمة من علامات التنسيق الزائدة (Markdown)
 */
function cleanJsonResponse(text: string): string {
    if (!text) return "{}";
    // إزالة علامات Markdown إذا وجدت
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    }
    return cleaned.trim();
}

/**
 * استخراج البيانات من صورة الخطاب (OCR)
 */
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
  const ai = getAiClient();
  
  const lettersContext = existingLetters.slice(0, 10).map(l => 
    `- ID: "${l.id}", Subject: "${l.subject}", Ref: "${l.internalRefNumber || ''}"`
  ).join('\n');

  const systemInstruction = `أنت خبير لغوي وإداري متخصص في استخلاص البيانات.
  ${ARABIC_STRICT_INSTRUCTION}
  المطلوب استخراج: الموضوع، المرسل، المستلم، التاريخ، رقم الصادر، وملخص.
  سياق المعاملات الموجودة للربط:
  ${lettersContext}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
        parts: [
            { text: "حلل صورة الخطاب واستخرج البيانات بصيغة JSON." },
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
            required: ["subject", "from", "to"]
        }
    }
  });

  return JSON.parse(cleanJsonResponse(response.text || "{}")) as ExtractedLetterDetails;
}

/**
 * تحليل النوايا والمسارات الاستراتيجية (كشف النوايا)
 */
export async function analyzeStrategicPaths(letter: Letter): Promise<StrategicAnalysis> {
    const ai = getAiClient();
    const content = letter.body.replace(/<[^>]*>?/gm, ' ');
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حلل هذا الخطاب استراتيجياً بكلمات عربية متصلة:\nالموضوع: ${letter.subject}\nالمحتوى: ${content}`,
        config: {
            systemInstruction: `أنت خبير استراتيجيات إداري. ${ARABIC_STRICT_INSTRUCTION} قم بكشف نوايا المرسل الحقيقية، ميزان القوة، المخاطر، واقترح 3 مسارات للرد.`,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    sender_intent: { type: Type.STRING },
                    power_balance: { type: Type.STRING },
                    risks: { type: Type.ARRAY, items: { type: Type.STRING } },
                    paths: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                title: { type: Type.STRING },
                                description: { type: Type.STRING },
                                logic: { type: Type.STRING },
                                impact: { type: Type.STRING },
                                suggestedObjective: { type: Type.STRING }
                            },
                            required: ["title", "description", "impact"]
                        }
                    }
                },
                required: ["sender_intent", "power_balance", "risks", "paths"]
            }
        }
    });

    return JSON.parse(cleanJsonResponse(response.text || "{}")) as StrategicAnalysis;
}

/**
 * توليد مسودات الخطابات (توليد ذكي)
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
    const ai = getAiClient();
    const { isReply, originalContent, objective, sender, receiver, subject, principles } = params;

    const systemInstruction = `أنت خبير صياغة إداري. ${ARABIC_STRICT_INSTRUCTION} ولد 3 نسخ (محايدة، حازمة، دبلوماسية) بتنسيق HTML غني. التخصيص: ${principles}`;
    const prompt = isReply 
        ? `رد على: ${originalContent}. الهدف: ${objective}. من: ${sender} إلى: ${receiver}. الموضوع: ${subject}`
        : `إنشاء خطاب: ${subject}. الهدف: ${objective}. من: ${sender} إلى: ${receiver}`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    analysis: {
                        type: Type.OBJECT,
                        properties: { strategic_feedback: { type: Type.ARRAY, items: { type: Type.STRING } } },
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

    return JSON.parse(cleanJsonResponse(response.text || "{}"));
}

/**
 * اقتراح مسارات الرد السريع
 */
export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const ai = getAiClient();
    const content = letter.summary || letter.body.replace(/<[^>]*>?/gm, ' ');
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `اقترح 3 مسارات للرد على خطاب: ${letter.subject}. المحتوى: ${content}.`,
        config: {
            systemInstruction: ARABIC_STRICT_INSTRUCTION,
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
    
    return JSON.parse(cleanJsonResponse(response.text || "[]")) as SmartReply[];
}

/**
 * تلخيص الخطاب (موجز المعاملة)
 */
export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const ai = getAiClient();
    const content = letter.body.replace(/<[^>]*>?/gm, ' ');
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص الخطاب واستخرج النقاط الرئيسية بكلمات عربية متصلة:\nالموضوع: ${letter.subject}\nالمحتوى: ${content}`,
        config: {
            systemInstruction: ARABIC_STRICT_INSTRUCTION,
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
    return JSON.parse(cleanJsonResponse(response.text || "{}"));
}

/**
 * تحسين جودة الصياغة الإدارية
 */
export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `راجع النص التالي وقدم اقتراحات صياغة بكلمات عربية متصلة:\n${text}`,
        config: {
            systemInstruction: ARABIC_STRICT_INSTRUCTION,
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
    return JSON.parse(cleanJsonResponse(response.text || "[]"));
}

/**
 * تلخيص سلسلة مراسلات كاملة
 */
export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = getAiClient();
    const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}\n${l.body.replace(/<[^>]*>?/gm, ' ')}`).join('\n---\n');
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص هذه السلسلة في فقرة واحدة بكلمات متصلة:\n\n${threadText}`,
        config: { systemInstruction: ARABIC_STRICT_INSTRUCTION }
    });
    return response.text || "";
}

/**
 * مساعد المتابعة الآلي
 */
export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = getAiClient();
    const summaries = letters.map(l => ({ id: l.id, subject: l.subject }));
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حدد المعاملات التي تحتاج لمتابعة: JSON:\n${JSON.stringify(summaries)}`,
        config: {
            systemInstruction: ARABIC_STRICT_INSTRUCTION,
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
    return JSON.parse(cleanJsonResponse(response.text || "[]"));
}

/**
 * البحث السياقي الذكي
 */
export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<any[]> {
    const ai = getAiClient();
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `ابحث سياقياً عن "${query}" في:\n${JSON.stringify(list)}`,
        config: { 
            systemInstruction: ARABIC_STRICT_INSTRUCTION,
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
                    required: ["letterId", "relevanceReason"]
                }
            }
        }
    });
    return JSON.parse(cleanJsonResponse(response.text || "[]"));
}

/**
 * تنقيح النص عبر الحوار الذكي
 */
export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const ai = getAiClient();
    const prompt = `الخطاب الحالي: ${currentBody}\nالسياق: ${context}\nالتعليمات: ${userInstruction}\nالمطلوب: تعديل النص وإرجاعه بتنسيق HTML بكلمات متصلة.`;
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            systemInstruction: `أنت مراجع لغوي وإداري عربي. ${ARABIC_STRICT_INSTRUCTION}`,
        }
    });
    return response.text || currentBody;
}
