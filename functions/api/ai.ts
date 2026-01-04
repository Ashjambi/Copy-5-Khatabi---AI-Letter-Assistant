
import { GoogleGenAI, Type } from "@google/genai";

export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { task, payload } = body;
    const apiKey = env.API_KEY || env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API_KEY_MISSING" }), { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    let modelName = "gemini-3-flash-preview"; 
    let responseSchema: any = undefined;
    let systemInstruction = "أنت خبير استراتيجيات إدارية عربي. يجب أن تكون الكلمات العربية متصلة تماماً (مثال: 'الموضوع' وليس 'ا ل م و ض و ع').";

    if (task === 'analyze_strategy') {
        // فكرة خارج الصندوق: تحليل الموقف الإداري قبل الصياغة
        systemInstruction += " حلل الخطاب الوارد المرفق وحدد: 1. ميزان القوة (صالحنا/صالحهم) 2. النقاط الحرجة 3. ثلاث استراتيجيات رد (دبلوماسية، حازمة، تعاونية).";
        responseSchema = {
            type: Type.OBJECT,
            properties: {
                situation_analysis: { type: Type.STRING, description: "تحليل دقيق للموقف الحالي" },
                power_balance: { type: Type.STRING, description: "وصف لميزان القوة الإداري" },
                strategies: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            title: { type: Type.STRING, description: "اسم الاستراتيجية" },
                            impact: { type: Type.STRING, description: "النتيجة المتوقعة لهذا الرد" },
                            logic: { type: Type.STRING, description: "المنطق خلف هذا المسار" },
                            suggested_objective: { type: Type.STRING }
                        }
                    }
                }
            },
            required: ["situation_analysis", "strategies"]
        };
    } else if (task === 'generate_variations') {
        modelName = "gemini-3-pro-preview"; // جودة فائقة للصياغة
        const { isReply, originalContent, objective, sender, receiver, subject, strategy_logic } = payload;
        systemInstruction += ` المطلوب توليد 3 نسخ بصيغة HTML. الاستراتيجية المتبعة: ${strategy_logic || 'رسمية'}`;
        const prompt = isReply 
            ? `الخطاب الوارد: ${originalContent}\nالهدف من الرد: ${objective}\nمن: ${sender} إلى: ${receiver}\nالموضوع: ${subject}`
            : `إنشاء خطاب جديد: ${subject}\nالمحتوى المطلوب: ${objective}\nمن: ${sender} إلى: ${receiver}`;
        
        responseSchema = {
            type: Type.OBJECT,
            properties: {
                analysis: { type: Type.OBJECT, properties: { strategic_feedback: { type: Type.ARRAY, items: { type: Type.STRING } } } },
                variations: {
                    type: Type.OBJECT,
                    properties: {
                        neutral: { type: Type.STRING },
                        strict: { type: Type.STRING },
                        diplomatic: { type: Type.STRING }
                    },
                    required: ["neutral", "strict", "diplomatic"]
                }
            }
        };
    } else if (task === 'refine_chat') {
        // الدردشة لتنقيح النص
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: payload,
            config: { systemInstruction: "أنت خبير صياغة. عدل النص الموفر لغوياً وإدارياً مع إبقاء الكلمات العربية متصلة." }
        });
        return new Response(JSON.stringify({ text: response.text }), { headers: { "Content-Type": "application/json" } });
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: typeof payload === 'string' ? payload : JSON.stringify(payload),
      config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema
      }
    });

    return new Response(response.text, { headers: { "Content-Type": "application/json" } });

  } catch (e: any) {
    const isQuotaError = e.message?.includes('429') || e.message?.includes('quota');
    return new Response(JSON.stringify({ 
        error: isQuotaError ? "تجاوزت حد الكوتا. يرجى الانتظار دقيقة." : e.message 
    }), { 
        status: isQuotaError ? 429 : 500,
        headers: { "Content-Type": "application/json" }
    });
  }
}
