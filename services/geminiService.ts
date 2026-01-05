
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, LetterVariations, StrategicAnalysis } from "../types";

/**
 * وظيفة عامة للتعامل مع طلبات الذكاء الاصطناعي عبر الـ Proxy
 */
async function callAiApi(task: string, payload: any) {
    const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, payload })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `خطأ في الاتصال بالذكاء الاصطناعي: ${response.status}`);
    }

    return await response.json();
}

/**
 * المسح الضوئي واستخراج البيانات (OCR) عبر Endpoint مخصص
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
        `ID: ${l.id}, Subject: ${l.subject}`
    ).join(' | ');

    const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mimeType, lettersContext })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'فشل المسح الضوئي');
    }

    return await response.json();
}

/**
 * تحليل النوايا والمسارات الاستراتيجية
 */
export async function analyzeStrategicPaths(letter: Letter): Promise<StrategicAnalysis> {
    return await callAiApi('analyze_strategy', {
        subject: letter.subject,
        body: letter.body.replace(/<[^>]*>?/gm, ' ')
    });
}

/**
 * توليد مسودات الخطابات (التوليد الذكي)
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
    return await callAiApi('generate_variations', params);
}

/**
 * تلخيص الخطاب (الموجز التنفيذي)
 */
export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    return await callAiApi('analyze_brief', {
        subject: letter.subject,
        body: letter.body.replace(/<[^>]*>?/gm, ' ')
    });
}

/**
 * اقتراح مسارات الرد السريع
 */
export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    return await callAiApi('smart_replies', {
        subject: letter.subject,
        body: letter.body.replace(/<[^>]*>?/gm, ' ')
    });
}

/**
 * تنقيح النص عبر الحوار
 */
export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const result = await callAiApi('refine_chat', { currentBody, userInstruction, context });
    return result.text || currentBody;
}

/**
 * تحسين جودة الصياغة (التدقيق)
 */
export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    return await callAiApi('enhance_letter', text);
}

/**
 * متابعة المعاملات المعلقة
 */
export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    return await callAiApi('follow_up', list);
}

/**
 * البحث السياقي الذكي
 */
export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<any[]> {
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    return await callAiApi('smart_search', { query, list });
}

/**
 * تلخيص سلسلة مراسلات كاملة
 */
export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const text = thread.map(l => `${l.date}: ${l.subject}`).join(' -> ');
    const result = await callAiApi('summarize_thread', text);
    return result.text || "";
}
