
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Cloudflare Pages Function: /api/ocr
 * معالجة متقدمة للمستندات (PDF/Images) عبر Gemini 3
 */
export async function onRequestPost(context: any) {
  const { request } = context;

  try {
    // 1. استلام البيانات بصيغة JSON
    const body = await request.json();
    const { base64Image, mimeType, lettersContext } = body;

    if (!base64Image || !mimeType) {
      return new Response(JSON.stringify({ error: "Missing document data" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    // 2. تنظيف الـ Base64 (إزالة الترويسات إن وجدت)
    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const finalData = cleanBase64.replace(/\s/g, "");

    // 3. تهيئة المحرك (الالتزام بـ process.env.API_KEY)
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

    const systemInstruction = `أنت مساعد إداري خبير في أرشفة الوثائق العربية.
يجب أن تكون جميع المخرجات باللغة العربية بكلمات متصلة وحروف طبيعية تماماً.
يُمنع تقطيع الحروف (مثال: اكتب "المعاملة" وليس "ا ل م ع ا م ل ة").
سياق المعاملات السابقة للمطابقة:
${lettersContext}`;

    // 4. استدعاء الموديل باستخدام الهيكلية المعتمدة لـ PDF والصور
    // نستخدم gemini-3-flash-preview لقدرته الفائقة على معالجة السياق الطويل والمستندات
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { 
            inlineData: { 
              mimeType: mimeType, 
              data: finalData
            } 
          },
          { 
            text: `قم بتحليل هذا المستند واستخرج البيانات التالية بدقة في صيغة JSON:
            - subject: عنوان أو موضوع الخطاب
            - from: الجهة المرسلة
            - to: الجهة الموجه إليها الخطاب
            - date: تاريخ الخطاب كما ورد فيه
            - externalRefNumber: رقم القيد أو الصادر الخارجي
            - summary: ملخص تنفيذي للمحتوى (بحدود 30 كلمة)
            - category: تصنيف إداري مقترح
            - referenceId: معرف المعاملة المرتبطة من السياق المقدم إن وجد`
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

    // 5. التحقق من سلامة الرد
    if (!response.text) {
        console.error("Gemini empty response or blocked content.");
        return new Response(JSON.stringify({ error: "Gemini rejected the content analysis." }), { status: 500 });
    }

    return new Response(response.text, {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      }
    });

  } catch (error: any) {
    console.error("Critical OCR Error:", error);
    
    // تشخيص الأخطاء الشائعة
    let userMsg = "حدث خطأ أثناء تحليل المستند سحابياً.";
    if (error?.message?.includes("413") || error?.message?.includes("large")) {
        userMsg = "حجم الملف كبير جداً بالنسبة للخادم.";
    } else if (error?.message?.includes("API key")) {
        userMsg = "مفتاح الوصول غير صالح أو لم يتم ضبطه في Cloudflare.";
    }

    return new Response(JSON.stringify({ 
      error: userMsg, 
      details: error.message 
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
}
