
import { GoogleGenAI, Type } from "@google/genai";

/**
 * وظيفة رفع الملف إلى Gemini File API
 */
async function uploadToGemini(file: File, apiKey: string) {
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

  const data = await uploadRes.json();
  if (!uploadRes.ok) {
    throw new Error(`File upload failed: ${JSON.stringify(data)}`);
  }

  return data.file.uri;
}

/**
 * Cloudflare Pages Function: /api/ocr
 * تطبيق استراتيجية File API لضمان استقرار معالجة المستندات.
 */
export async function onRequestPost(context: any) {
  const { request } = context;

  try {
    // 1. استخراج البيانات من FormData
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const lettersContext = formData.get("lettersContext") as string || "";

    if (!file) {
      return new Response(JSON.stringify({ error: "لم يتم استلام أي ملف." }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    // 2. الحصول على مفتاح الـ API (نلتزم بـ process.env.API_KEY)
    const apiKey = process.env.API_KEY || "";
    if (!apiKey) {
        throw new Error("API_KEY is not defined in the environment.");
    }

    // 3. الخطوة الحاسمة: رفع الملف إلى Gemini للحصول على URI
    const fileUri = await uploadToGemini(file, apiKey);

    // 4. تهيئة المحرك للصياغة والتحليل
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `أنت مساعد إداري خبير في أرشفة الوثائق الرسمية العربية.
يجب أن تكون جميع المخرجات باللغة العربية بكلمات متصلة وحروف طبيعية تماماً.
يُمنع تقطيع الحروف (مثال: اكتب "المعاملة" وليس "ا ل م ع ا م ل ة").
سياق المعاملات السابقة للمطابقة:
${lettersContext}`;

    // 5. طلب تحليل المستند باستخدام المرجع (fileData)
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { fileData: { fileUri: fileUri, mimeType: file.type || "application/pdf" } },
            { 
              text: `حلل هذا المستند بدقة واستخرج البيانات التالية بصيغة JSON:
              - subject: موضوع الخطاب
              - from: الجهة المرسلة
              - to: الجهة المستلمة
              - date: التاريخ
              - externalRefNumber: رقم الصادر الخارجي
              - summary: ملخص الإجراء (كلمات متصلة)
              - category: تصنيف مقترح
              - referenceId: معرف المعاملة المرتبطة من السياق إن وجد` 
            }
          ]
        }
      ],
      config: {
        systemInstruction,
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

    // 6. إرجاع النتيجة النهائية
    if (!response.text) {
        throw new Error("Gemini returned an empty analysis result.");
    }

    return new Response(response.text, {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      }
    });

  } catch (error: any) {
    console.error("Critical Cloudflare OCR Failure:", error);
    
    return new Response(JSON.stringify({ 
      error: "حدث خطأ تقني أثناء تحليل المستند سحابياً.", 
      details: error.message 
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
}
