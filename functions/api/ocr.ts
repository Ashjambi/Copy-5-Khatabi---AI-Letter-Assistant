
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Cloudflare Pages Function: /api/ocr
 * معالجة المستندات عبر Gemini File API.
 */
export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const lettersContext = formData.get("lettersContext") as string || "";

    if (!file) {
      return new Response("No file provided", { status: 400 });
    }

    // جلب المفتاح مباشرة من بيئة Cloudflare (المعرفة في Settings -> Variables)
    const apiKey = env.API_KEY || env.GEMINI_API_KEY;

    // 1) مرحلة الرفع إلى Gemini File API (v1beta/files) للحصول على مرجع الملف
    // نستخدم fetch مباشر لضمان استلام رسالة الخطأ الأصلية من جوجل في حال فشل الرفع
    const uploadRes = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "raw",
          "Content-Type": file.type || "application/pdf"
        },
        body: await file.arrayBuffer()
      }
    );

    const uploadText = await uploadRes.text();
    
    if (!uploadRes.ok) {
      // إرجاع رد جوجل كما هو (يحتوي على سبب الرفض الحقيقي مثل INVALID_ARGUMENT أو UNAUTHORIZED)
      return new Response(`UPLOAD_FAILED_RESPONSE: ${uploadText}`, { 
        status: uploadRes.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const uploadData = JSON.parse(uploadText);
    const fileUri = uploadData.file.uri;

    // 2) مرحلة التحليل باستخدام محرك Gemini 3 Flash
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { fileData: { fileUri: fileUri, mimeType: file.type || "application/pdf" } },
            { 
              text: `حلل الوثيقة المرفقة واستخرج البيانات التالية بصيغة JSON حصراً وبكلمات عربية متصلة وطبيعية:
              - subject: الموضوع
              - from: الجهة المرسلة
              - to: الجهة المستلمة
              - date: التاريخ
              - externalRefNumber: رقم الصادر الخارجي
              - summary: ملخص الإجراء (كلمات متصلة)
              - category: تصنيف مقترح
              - referenceId: معرف المعاملة المرتبطة من السياق التالي إن وجد: ${lettersContext}` 
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
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      }
    });

  } catch (e: any) {
    // خطأ تقني في بيئة التشغيل (مثل ReferenceError أو Network Error)
    return new Response(`RUNTIME_ERROR: ${e.message}`, { status: 500 });
  }
}
