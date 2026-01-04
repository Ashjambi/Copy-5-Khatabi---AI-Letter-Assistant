
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Cloudflare Pages Function: /api/ocr
 * تستخدم onRequestPost لاستقبال البيانات الضخمة (Base64) عبر طلب POST.
 */
export async function onRequestPost(context: any) {
  const { request } = context;

  try {
    // 1. قراءة البيانات من جسم الطلب (JSON)
    const body = await request.json();
    const { base64Image, mimeType, lettersContext } = body;

    if (!base64Image || !mimeType) {
      return new Response(JSON.stringify({ error: "Missing file data" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    // 2. تهيئة محرك Gemini (تلتزم باستخدام process.env.API_KEY)
    // ملاحظة: Cloudflare Pages يحقن المتغيرات في process.env تلقائياً عند ضبطها في Settings
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

    const systemInstruction = `أنت خبير أرشفة إداري ذكي.
قاعدة لغوية قطعية: يجب أن تكون جميع المخرجات باللغة العربية بكلمات متصلة وحروف طبيعية تماماً.
يُمنع منعاً باتاً تقطيع الحروف (مثال: اكتب "المعاملة" وليس "ا ل م ع ا م ل ة").
سياق المعاملات السابقة للمطابقة:
${lettersContext}`;

    // 3. استدعاء Gemini 3 Flash (الموديل الأسرع والأفضل للمستندات)
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { 
            inlineData: { 
              mimeType: mimeType, 
              data: base64Image.replace(/^data:.*,/, "").replace(/\s/g, "") 
            } 
          },
          { 
            text: `حلل هذه الوثيقة واستخرج البيانات التالية بصيغة JSON:
            - subject: الموضوع
            - from: المرسل
            - to: المستلم
            - date: التاريخ
            - externalRefNumber: رقم الصادر الخارجي
            - summary: ملخص الإجراء
            - category: التصنيف
            - referenceId: معرف المعاملة المرتبطة إن وجد` 
          }
        ]
      },
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

    // 4. إرجاع النتيجة
    return new Response(response.text, {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      }
    });

  } catch (error: any) {
    console.error("Function OCR Error:", error);
    
    // رسالة خطأ ذكية بناءً على تشخيص الحالة
    let message = "فشل في معالجة المستند سحابياً.";
    if (error?.message?.includes("API key")) {
        message = "خطأ في مفتاح الوصول (API_KEY) داخل إعدادات Cloudflare.";
    }

    return new Response(JSON.stringify({ 
      error: message, 
      details: error.message 
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
}
