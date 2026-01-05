
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, LetterVariations, StrategicAnalysis } from "../types";

/**
 * وظيفة موحدة لإرسال الطلبات للسيرفر (Proxy)
 * تضمن بقاء مفتاح API آمناً في السيرفر وعدم تعطل المتصفح
 */
async function callProxy(endpoint: string, data: any) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json();
        // معالجة خطأ الكوتا أو الضغط على السيرفر
        if (response.status === 429) {
            throw new Error("النظام مشغول حالياً، يرجى المحاولة بعد قليل.");
        }
        throw new Error(error.error || "حدث خطأ أثناء الاتصال بمحرك الذكاء الاصطناعي");
    }

    return await response.json();
}

/**
 * المسح الضوئي (OCR) - مفصول عن بقية الخدمات
 */
export async function extractDetailsFromLetterImage(
    base64Data: string,
    mimeType: string,
    departments: string[],
    letterTypes: string[],
    priorityLevels: string[],
    confidentialityLevels: string[],
    existingCategories: string[],
    existingLetters: any[]
): Promise<ExtractedLetterDetails> {
    const lettersContext = existingLetters.slice(0, 10).map(l => 
        `ID: ${l.id}, Sub: ${l.subject}`
    ).join(' | ');

    return await callProxy('/api/ocr', { base64Data, mimeType, lettersContext });
}

/**
 * تحليل المسارات والنوايا الاستراتيجية
 */
export async function analyzeStrategicPaths(letter: Letter): Promise<StrategicAnalysis> {
    return await callProxy('/api/ai', {
        task: 'analyze_strategy',
        payload: {
            subject: letter.subject,
            body: letter.body.replace(/<[^>]*>?/gm, ' ')
        }
    });
}

/**
 * توليد مسودات الخطابات
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
    return await callProxy('/api/ai', { task: 'generate_variations', payload: params });
}

/**
 * تلخيص الخطاب (الموجز)
 */
export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    return await callProxy('/api/ai', {
        task: 'analyze_brief',
        payload: {
            subject: letter.subject,
            body: letter.body.replace(/<[^>]*>?/gm, ' ')
        }
    });
}

/**
 * اقتراح مسارات الرد السريع
 */
export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    return await callProxy('/api/ai', {
        task: 'smart_replies',
        payload: {
            subject: letter.subject,
            body: letter.body.replace(/<[^>]*>?/gm, ' ')
        }
    });
}

/**
 * تنقيح النص عبر الحوار
 */
export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const result = await callProxy('/api/ai', {
        task: 'refine_chat',
        payload: { currentBody, userInstruction, context }
    });
    return result.text || currentBody;
}

/**
 * تحسين جودة الصياغة
 */
export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    return await callProxy('/api/ai', { task: 'enhance_letter', payload: text });
}

/**
 * مساعد المتابعة
 */
export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    return await callProxy('/api/ai', { task: 'follow_up', payload: list });
}

/**
 * البحث الذكي
 */
export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<any[]> {
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    return await callProxy('/api/ai', { task: 'smart_search', payload: { query, list } });
}

/**
 * تلخيص السلسلة
 */
export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const text = thread.map(l => `${l.date}: ${l.subject}`).join(' -> ');
    const result = await callProxy('/api/ai', { task: 'summarize_thread', payload: text });
    return result.text || "";
}
