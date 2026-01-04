
import { GoogleGenAI, Type } from "@google/genai";

export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { base64Data, mimeType, lettersContext } = body;

    if (!base64Data) {
      return new Response(JSON.stringify({ error: "لم يتم توفير بيانات الملف" }), { status: 400 });
    }

    const apiKey = env.API_KEY || env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "مفتاح الـ API غير مهيأ في السيرفر" }), { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType || "image/jpeg" } },
            { 
              text: `أنت خبير أرشفة إداري. استخرج البيانات بكلمات عربية متصلة تماماً.
              المطلوب JSON:
              - subject: موضوع الخطاب
              - from: الجهة المرسلة
              - to: القسم المستلم المقترح
              - date: التاريخ (YYYY-MM-DD)
              - externalRefNumber: رقم الصادر الخارجي
              - summary: ملخص تنفيذي سطر واحد
              - referenceId: معرف المعاملة المرتبطة إن وجد صلة: ${lettersContext}` 
            }
          ]
        }
      ],
      config: {
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
            referenceId: { type: Type.STRING }
          },
          required: ["subject", "from", "to"]
        }
      }
    });

    return new Response(response.text, {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e: any) {
    console.error("OCR Proxy Error:", e);
    const status = e.message?.includes('429') ? 429 : 500;
    return new Response(JSON.stringify({ error: status === 429 ? "تم تجاوز حد استخدام الكوتا اليومي لمسح المستندات." : e.message }), { 
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
}
