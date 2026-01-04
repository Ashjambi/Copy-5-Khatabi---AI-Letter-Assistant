
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone } from "../types";

/**
 * دالة مساعدة لإرسال المهام إلى الوظيفة السحابية الآمنة
 */
async function sendToAiBackend(payload: any, config: any = {}) {
    const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, config })
    });
    
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "AI Backend Error");
    }
    
    return await response.json();
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
  // OCR لا يزال يستخدم مسار /api/ocr المخصص لمعالجة الصور
  const formData = new FormData();
  const blob = await (await fetch(`data:${mimeType};base64,${base64Image}`)).blob();
  formData.append('file', blob, 'document.pdf');
  
  const context = existingLetters.map(l => 
    `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", Subject: "${l.subject}"`
  ).join('\n');
  formData.append('lettersContext', context);

  const response = await fetch('/api/ocr', { method: 'POST', body: formData });
  if (!response.ok) throw new Error("فشل تحليل الصورة سحابياً.");
  return await response.json();
}

export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const content = letter.summary || letter.body.replace(/<[^>]*>?/gm, ' ');
    const prompt = `أنت مستشار إداري. اقترح 3 مسارات رد استراتيجية لهذا الخطاب: "${letter.subject}". المحتوى: ${content}. تأكد أن النصوص العربية متصلة تماماً.`;

    const schema = {
        type: 'ARRAY',
        items: {
            type: 'OBJECT',
            properties: {
                title: { type: 'STRING', description: "عنوان المسار" },
                objective: { type: 'STRING', description: "التوجيه المقترح" },
                tone: { type: 'STRING', description: "النبرة الإدارية" },
                type: { type: 'STRING', enum: ["positive", "negative", "neutral", "inquiry"] }
            },
            required: ["title", "objective", "tone", "type"]
        }
    };

    try {
        const result = await sendToAiBackend(prompt, {
            responseMimeType: "application/json",
            responseSchema: schema
        });
        return Array.isArray(result) ? result : [];
    } catch (e) {
        console.error("Smart Replies Error:", e);
        return [];
    }
}

export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const prompt = `حسن الصياغة الإدارية للنص التالي مع إبقاء الكلمات متصلة:\n\n${text}`;
    const schema = {
        type: 'ARRAY',
        items: {
            type: 'OBJECT',
            properties: {
                original_part: { type: 'STRING' },
                suggested_improvement: { type: 'STRING' },
                reason: { type: 'STRING' }
            },
            required: ["original_part", "suggested_improvement", "reason"]
        }
    };
    return await sendToAiBackend(prompt, { responseMimeType: "application/json", responseSchema: schema });
}

export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const text = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}`).join('\n');
    const prompt = `لخص سلسلة المراسلات هذه بكلمات عربية متصلة:\n\n${text}`;
    const result = await sendToAiBackend(prompt, { temperature: 0.1 });
    return typeof result === 'string' ? result : (result.text || "");
}

export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    const prompt = `حلل المعاملات التي تحتاج متابعة عاجلة: ${JSON.stringify(list)}`;
    const schema = {
        type: 'ARRAY',
        items: {
            type: 'OBJECT',
            properties: {
                letterId: { type: 'STRING' },
                summary: { type: 'STRING' }
            },
            required: ["letterId", "summary"]
        }
    };
    return await sendToAiBackend(prompt, { responseMimeType: "application/json", responseSchema: schema });
}

export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<any[]> {
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    const prompt = `ابحث سياقياً عن "${query}" في: ${JSON.stringify(list)}`;
    return await sendToAiBackend(prompt, { responseMimeType: "application/json" });
}

export async function generateLetterVariations(context: any) {
    const systemInstruction = `أنت خبير صياغة إدارية. قاعدة لغوية: كلمات متصلة حروفها طبيعية تماماً. المهمة: 3 مسودات HTML. الأسلوب: ${context.principles}`;
    const prompt = context.isReply 
        ? `رد على: ${context.originalContent}. التوجيه: ${context.objective}. من ${context.sender} إلى ${context.receiver}. الموضوع: ${context.subject}.`
        : `إنشاء خطاب: ${context.subject}. المحتوى: ${context.objective}. المرسل: ${context.sender} | المستلم: ${context.receiver}.`;

    const schema = {
        type: 'OBJECT',
        properties: {
            analysis: { type: 'OBJECT', properties: { strategic_feedback: { type: 'ARRAY', items: { type: 'STRING' } } } },
            variations: {
                type: 'OBJECT',
                properties: { 
                    neutral: { type: 'STRING' }, 
                    strict: { type: 'STRING' }, 
                    diplomatic: { type: 'STRING' } 
                },
                required: ["neutral", "strict", "diplomatic"]
            }
        }
    };

    return await sendToAiBackend(prompt, {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema
    });
}
