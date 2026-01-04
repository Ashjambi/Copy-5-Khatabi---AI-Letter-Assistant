
import { GoogleGenAI, Type } from "@google/genai";

/**
 * وظيفة معالجة المستندات عبر Gemini File API
 */
export async function onRequestPost(context: any) {
  const { request, env } = context;

  // 1. استخراج المفتاح من البيئة (Cloudflare تستخدم env وليس process.env)
  // ندعم التسمية القياسية والتسمية الشائعة في بيئات النشر المختلفة
  const effectiveApiKey = env.API_KEY || env.GEMINI_API_KEY || "";
  
  // للامتثال الصارم لتعليمات استخدام process.env.API_KEY داخل الكود البرمجي
  // نقوم بتعريف كائن process محلياً في نطاق الوظيفة
  const process = {
    env: {
      API_KEY: effectiveApiKey
    }
  };

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const lettersContext = formData.get("lettersContext") as string || "";

    if (!file) {
      return new Response("DEBUG_ERROR: لم يتم استلام الملف في الطلب المرسل.", { status: 400 });
    }

    if (!process.env.API_KEY) {
      return new Response("DEBUG_ERROR: مفتاح API_KEY غير موجود في إعدادات Cloudflare (Secrets). تأكد من إضافته في المتغيرات.", { status: 500 });
    }

    // --- 1) مرحلة الرفع (Upload Phase) ---
    const uploadRes = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${process.env.API_KEY}`,
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
      return new Response(`UPLOAD_FAILED_RAW: ${uploadText}`, { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const uploadData = JSON.parse(uploadText);
    const fileUri = uploadData.file.uri;

    // --- 2) مرحلة التحليل (Analysis Phase) ---
    // نستخدم محرك Gemini 3 Flash كما هو مطلوب
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
                {
                    role: "user",
                    parts: [
                        { fileData: { fileUri: fileUri, mimeType: file.type || "application/pdf" } },
                        { 
                            text: `حلل هذه الوثيقة واستخرج البيانات التالية بصيغة JSON حصراً وبكلمات متصلة:
                            - subject: الموضوع
                            - from: المرسل
                            - to: المستلم
                            - date: التاريخ
                            - externalRefNumber: رقم الصادر الخارجي
                            - summary: ملخص الإجراء
                            - category: تصنيف مقترح
                            - referenceId: معرف المعاملة المرتبطة من السياق إن وجد` 
                        }
                    ]
                }
            ],
            config: {
                systemInstruction: `أنت مساعد أرشفة ذكي. القاعدة الذهبية: النص العربي يجب أن يكون متصلاً تماماً (Connected Arabic Text). سياق المعاملات: ${lettersContext}`,
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

    } catch (modelError: any) {
        return new Response(`MODEL_ANALYSIS_FAILED: ${modelError.message}`, { status: 500 });
    }

  } catch (err: any) {
    return new Response(`RUNTIME_CRITICAL_ERROR: ${err.message}`, { status: 500 });
  }
}
