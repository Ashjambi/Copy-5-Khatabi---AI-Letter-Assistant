
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, LetterVariations } from "../types";

/**
 * دالة مساعدة مركزية للاتصال بالخلفية (Backend)
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
 * استخلاص البيانات من وثائق PDF أو الصور عبر بوابة OCR الخلفية
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
 * توليد تنويعات الخطاب عبر بوابة AI الخلفية
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
    const { isReply, originalContent, objective, sender, receiver, subject, principles } = params;

    const systemInstruction = `أنت خبير صياغة إداري عربي. الكلمات العربية متصلة دائماً.
    المطلوب: توليد 3 نسخ (محايدة، حازمة، دبلوماسية) بتنسيق HTML.
    الأسلوب المفضل: ${principles}`;

    const prompt = isReply 
        ? `رد على: ${originalContent}. الهدف: ${objective}. من: ${sender} إلى: ${receiver}. الموضوع: ${subject}`
        : `خطاب جديد: ${subject}. المحتوى المطلوب: ${objective}. من: ${sender} إلى: ${receiver}`;

    return await callBackend('/api/ai', {
        task: 'generate_variations',
        payload: prompt,
        config: { systemInstruction }
    });
}

/**
 * توليد مسارات رد ذكية
 */
export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const content = letter.summary || letter.body.replace(/<[^>]*>?/gm, ' ');
    return await callBackend('/api/ai', {
        task: 'smart_replies',
        payload: `اقترح 3 مسارات استراتيجية للرد على هذا الخطاب: "${letter.subject}". المحتوى: ${content}.`
    });
}

/**
 * تحليل موجز للخطاب
 */
export async function analyzeLetterBrief(letter: Letter): Promise<{ summary: string, keyPoints: string[] }> {
    const content = letter.body.replace(/<[^>]*>?/gm, ' ');
    return await callBackend('/api/ai', {
        task: 'analyze_brief',
        payload: `حلل الخطاب واستخرج ملخصاً ونقاط العمل بكلمات متصلة:\n\nالموضوع: ${letter.subject}\nالمحتوى: ${content}`
    });
}

/**
 * تحسين الصياغة
 */
export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    return await callBackend('/api/ai', {
        task: 'enhance_text',
        payload: `راجع النص وقدم اقتراحات لتحسين صياغته الإدارية بكلمات متصلة:\n\n${text}`
    });
}

/**
 * ملخص المتابعة
 */
export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const summaries = letters.map(l => ({ id: l.id, subject: l.subject }));
    return await callBackend('/api/ai', {
        task: 'follow_up',
        payload: `حدد المعاملات التي تحتاج متابعة عاجلة من القائمة:\n\n${JSON.stringify(summaries)}`
    });
}

/**
 * البحث الذكي
 */
export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<any[]> {
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    return await callBackend('/api/ai', {
        task: 'smart_search',
        payload: `ابحث سياقياً عن "${query}" في القائمة التالية: ${JSON.stringify(list)}`
    });
}

/**
 * تلخيص سلسلة مراسلات
 */
export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}`).join('\n');
    return await callBackend('/api/ai', {
        task: 'summarize_thread',
        payload: `لخص سلسلة المراسلات هذه في فقرة واحدة بكلمات متصلة:\n\n${threadText}`
    });
}

/**
 * تنقيح نص الخطاب عبر الدردشة
 */
export async function refineLetterWithChat(currentBody: string, userInstruction: string, context: string): Promise<string> {
    const prompt = `الخطاب الحالي: ${currentBody}\nالسياق: ${context}\nتعليمات المستخدم: ${userInstruction}\nالمطلوب: تعديل النص وإرجاعه بتنسيق HTML وبكلمات عربية متصلة تماماً.`;
    const result = await callBackend('/api/ai', {
        task: 'refine_chat',
        payload: prompt
    });
    return typeof result === 'string' ? result : (result.text || currentBody);
}
