
import { GoogleGenAI, Type } from "@google/genai";

export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { base64Data, mimeType, lettersContext } = body;

    if (!base64Data) {
      return new Response("Missing image data", { status: 400 });
    }

    const apiKey = env.API_KEY || env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey });
    
    // استخدام inlineData مباشرة بدلاً من File API لتسريع العملية
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType || "image/jpeg" } },
            { 
              text: `أنت خبير أرشفة. استخرج البيانات بكلمات عربية متصلة (لا تقطع الحروف).
              المطلوب JSON:
              - subject: الموضوع بدقة
              - from: المرسل
              - to: المستلم المقترح
              - date: التاريخ (YYYY-MM-DD)
              - externalRefNumber: رقم الصادر
              - summary: ملخص تنفيذي (سطر واحد)
              - category: تصنيف (مثال: مالي، قانوني، إداري)
              - referenceId: تطابق مع أحد المعرفات التالية إن وجد صلة: ${lettersContext}` 
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
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
