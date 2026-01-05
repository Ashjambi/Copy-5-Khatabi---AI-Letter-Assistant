
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, LetterVariations, StrategicAnalysis } from "../types";

/**
 * دالة مساعدة موحدة لإرسال الطلبات إلى الخادم الوسيط (Proxy)
 * هذا يمنع وجود مفتاح الـ API في الكود المجمع للمتصفح.
 */
async function callProxy(endpoint: string, body: any) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `خطأ في الاتصال بالخادم: ${response.status}`);
    }

    return response.json();
}

/**
 * تحليل المسارات الاستراتيجية عبر البروكسي
 */
export async function analyzeStrategicPaths(letter: Letter): Promise<StrategicAnalysis> {
    return callProxy('/api/ai', {
        task: 'analyze_strategy',
        payload: {
            subject: letter.subject,
            body: letter.body.replace(/<[^>]*>?/gm, ' ')
        }
    });
}

/**
 * توليد مسودات الخطابات عبر البروكسي
 */
export async function generateLetterVariations(params: {
    isReply: boolean,
    originalContent?: string,
    objective: string,
    sender: string,
    receiver: string,
    subject: string,
    strategy_logic?: string
}): Promise<{ variations: LetterVariations, analysis: { strategic_feedback: string[] } }> {
    return callProxy('/api/ai', {
        task: 'generate_variations',
        payload: params
    });
}

/**
 * المسح الضوئي واستخراج البيانات عبر البروكسي المخصص (OCR)
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
    return callProxy('/api/ocr', {
        base64Data,
        mimeType,
        lettersContext: JSON.stringify(existingLetters.slice(0, 10)) // إرسال سياق محدود للأداء
    });
}

/**
 * تنقيح النص بالحوار عبر البروكسي
 */
export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const result = await callProxy('/api/ai', {
        task: 'refine_chat',
        payload: { currentBody, userInstruction, context }
    });
    return result.text || currentBody;
}

/**
 * تلخيص الخطاب
 */
export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    return callProxy('/api/ai', {
        task: 'analyze_brief',
        payload: { subject: letter.subject, body: letter.body }
    });
}

/**
 * توليد الردود الذكية
 */
export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    return callProxy('/api/ai', {
        task: 'smart_replies',
        payload: { subject: letter.subject, body: letter.body }
    });
}

/**
 * تلخيص سلسلة المراسلات
 */
export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const result = await callProxy('/api/ai', {
        task: 'thread_summary',
        payload: thread.map(l => ({ from: l.from, subject: l.subject }))
    });
    return result.summary || "";
}

/**
 * الحصول على ملخص المتابعة
 */
export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    return callProxy('/api/ai', {
        task: 'follow_up',
        payload: letters.map(l => ({ id: l.id, subject: l.subject }))
    });
}

/**
 * البحث السياقي الذكي
 */
export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<any[]> {
    return callProxy('/api/ai', {
        task: 'smart_search',
        payload: { query, letters: letters.map(l => ({ id: l.id, subject: l.subject })) }
    });
}

/**
 * تحسين صياغة الخطاب
 */
export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    return callProxy('/api/ai', {
        task: 'enhance_letter',
        payload: text
    });
}
