
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, LetterVariations } from "../types";

/**
 * دالة مساعدة مركزية للاتصال بالبوابة الخلفية (Backend Proxy)
 */
async function callBackend(endpoint: string, body: any) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'فشل الاتصال بخدمة الذكاء الاصطناعي');
  }

  return await response.json();
}

/**
 * استخلاص البيانات من وثائق PDF أو الصور (OCR الذكي) عبر السيرفر
 */
export async function extractDetailsFromLetterImage(
  base64Data: string,
  mimeType: string,
  departments: string[],
  letterTypes: string[],
  priorityLevels: string[],
  confidentialityLevels: string[],
  existingCategories: string[],
  existingLetters: { id: string, subject: string, internalRefNumber?: string, externalRefNumber?: string, date: string }[]
): Promise<ExtractedLetterDetails> {
  const lettersContext = existingLetters.map(l => 
    `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", Subject: "${l.subject}"`
  ).join('\n');

  return await callBackend('/api/ocr', {
    base64Data,
    mimeType,
    lettersContext
  });
}

/**
 * توليد تنويعات الخطاب عبر السيرفر
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
    return await callBackend('/api/ai', {
        task: 'generate_variations',
        payload: { ...params }
    });
}

/**
 * توليد مسارات رد استراتيجية (Smart Replies) عبر السيرفر
 */
export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const content = letter.summary || letter.body.replace(/<[^>]*>?/gm, ' ');
    const payload = `حلل الخطاب التالي واقترح 3 مسارات رد مهنية: 
    الموضوع: ${letter.subject}
    المحتوى: ${content}`;

    return await callBackend('/api/ai', {
        task: 'smart_replies',
        payload
    });
}

/**
 * تحليل محتوى الخطاب (Brief) عبر السيرفر
 */
export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const content = letter.body.replace(/<[^>]*>?/gm, ' ');
    const payload = `حلل الخطاب واستخرج ملخصاً ونقاط العمل بكلمات عربية متصلة:\n\nالموضوع: ${letter.subject}\nالمحتوى: ${content}`;
    
    return await callBackend('/api/ai', {
        task: 'analyze_brief',
        payload
    });
}

/**
 * تحسين الصياغة الإدارية عبر السيرفر
 */
export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    return await callBackend('/api/ai', {
        task: 'enhance_text',
        payload: `راجع النص التالي وقدم اقتراحات لتحسين صياغته الإدارية العربية:\n\n${text}`
    });
}

/**
 * تنقيح نص الخطاب عبر الدردشة عبر السيرفر
 */
export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const prompt = `الخطاب الحالي: ${currentBody}\nالسياق: ${context}\nتعليمات المستخدم: ${userInstruction}\nالمطلوب: تعديل النص وإرجاعه بتنسيق HTML وبكلمات عربية متصلة تماماً.`;
    const result = await callBackend('/api/ai', {
        task: 'refine_chat',
        payload: prompt
    });
    return typeof result === 'string' ? result : (result.text || currentBody);
}

/**
 * تلخيص سلسلة مراسلات عبر السيرفر
 */
export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}`).join('\n');
    const result = await callBackend('/api/ai', {
        task: 'summarize_thread',
        payload: `لخص سلسلة المراسلات هذه في فقرة واحدة بكلمات متصلة:\n\n${threadText}`
    });
    return typeof result === 'string' ? result : (result.text || "تعذر التلخيص.");
}

/**
 * البحث الذكي عبر السيرفر
 */
export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<any[]> {
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    return await callBackend('/api/ai', {
        task: 'smart_search',
        payload: `ابحث سياقياً عن "${query}" في القائمة التالية وأعد النتائج المرتبطة بصيغة JSON:\n\n${JSON.stringify(list)}`
    });
}

/**
 * ملخص المتابعة عبر السيرفر
 */
export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const summaries = letters.map(l => ({ id: l.id, subject: l.subject }));
    return await callBackend('/api/ai', {
        task: 'follow_up',
        payload: `حدد المعاملات التي تحتاج متابعة عاجلة من القائمة بصيغة JSON:\n\n${JSON.stringify(summaries)}`
    });
}
