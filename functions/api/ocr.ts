
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Cloudflare Pages Function لمعالجة الـ OCR.
 * تستخدم هذه الوظيفة onRequestPost لضمان استلام البيانات عبر POST.
 */
export async function onRequestPost(context: any) {
    const { request } = context;
    
    try {
        // قراءة البيانات من جسم الطلب
        const body = await request.json();
        const { base64Image, mimeType, lettersContext } = body;

        if (!base64Image || !mimeType) {
            return new Response(JSON.stringify({ error: "Missing required data: base64Image or mimeType" }), { 
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // تهيئة Gemini API باستخدام المفتاح من بيئة التشغيل
        // ملاحظة: تلتزم الوظيفة باستخدام process.env.API_KEY وفقاً للتعليمات
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
        
        const systemInstruction = `أنت مساعد أرشفة إداري ذكي متخصص في تحليل الوثائق الرسمية.
يجب أن تكون جميع المخرجات باللغة العربية بكلمات متصلة وحروف طبيعية تماماً.
يُمنع منعاً باتاً تقطيع الحروف (مثال: اكتب "المعاملة" وليس "ا ل م ع ا م ل ة").
سياق المعاملات السابقة للمطابقة:
${lettersContext}`;

        // إرسال الطلب لموديل Gemini 3 Flash
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: {
                parts: [
                    { inlineData: { mimeType, data: base64Image.replace(/\s/g, "") } },
                    { text: `حلل هذه الوثيقة واستخرج البيانات التالية بصيغة JSON حصراً:
                    - subject: موضوع الخطاب
                    - from: جهة الإرسال
                    - to: جهة الاستلام (القسم)
                    - date: التاريخ المذكور في الخطاب
                    - externalRefNumber: رقم الصادر الخارجي إن وجد
                    - summary: ملخص قصير جداً للمحتوى
                    - category: تصنيف مقترح
                    - referenceId: معرف المعاملة المرتبطة من السياق إن وجد` }
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

        // إرجاع النتيجة للواجهة الأمامية
        return new Response(response.text, {
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (error: any) {
        console.error("Cloudflare Function OCR Error:", error);
        
        // معالجة الأخطاء الشائعة (مثل فشل المفتاح)
        let message = "فشل في معالجة الوثيقة سحابياً.";
        if (error?.message?.includes("API key")) {
            message = "مفتاح الـ API غير صالح أو غير مهيأ في إعدادات Cloudflare.";
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
