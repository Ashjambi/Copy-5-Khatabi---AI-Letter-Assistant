
import { GoogleGenAI, Type } from "@google/genai";

/**
 * وظيفة تشخيصية نهائية لمعالجة المستندات عبر Gemini File API
 */
export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const lettersContext = formData.get("lettersContext") as string || "";

    if (!file) {
      return new Response("DEBUG_ERROR: No file received in FormData", { status: 400 });
    }

    // في بيئة Cloudflare Pages، يتم الوصول للمتغيرات عبر env وليس process.env
    const apiKey = env.API_KEY || "";
    if (!apiKey) {
      return new Response("DEBUG_ERROR: API_KEY is missing in Cloudflare Environment Variables (Secret Key)", { status: 500 });
    }

    // --- 1) مرحلة الرفع (Upload Phase) ---
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
      return new Response(`UPLOAD_FAILED_RAW: ${uploadText}`, { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const uploadData = JSON.parse(uploadText);
    const fileUri = uploadData.file.uri;

    // --- 2) مرحلة التحليل (Analysis Phase) ---
    const ai = new GoogleGenAI({ apiKey });
    
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
                            - referenceId: معرف المعاملة المرتبطة إن وجد` 
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
