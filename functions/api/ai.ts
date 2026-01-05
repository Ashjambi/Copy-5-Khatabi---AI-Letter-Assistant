
import { GoogleGenAI, Type } from "@google/genai";

const ARABIC_STRICT_PROTOCOL = "قاعدة جوهرية: يجب أن تكون جميع النصوص العربية بكلمات متصلة وطبيعية (مثل: 'الموضوع' وليس 'ا ل م و ض و ع'). يُمنع منعاً باتاً تقطيع الحروف.";

export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { task, payload } = body;
    const apiKey = env.API_KEY || env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "مفتاح الـ API غير مهيأ في بيئة السيرفر." }), { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    // استخدام Flash كنموذج افتراضي لأنه أكثر استقراراً في الكوتا
    let modelName = "gemini-3-flash-preview"; 
    let responseSchema: any = undefined;
    let systemInstruction = `أنت خبير استراتيجيات إدارية عربي رفيع المستوى. ${ARABIC_STRICT_PROTOCOL}`;
    let prompt = "";

    if (task === 'analyze_strategy') {
        systemInstruction += " حلل الخطاب وحدد النوايا وميزان القوة و3 مسارات للرد.";
        prompt = `حلل الخطاب التالي:\nالموضوع: ${payload.subject}\nالمحتوى: ${payload.body}`;
        responseSchema = {
            type: Type.OBJECT,
            properties: {
                sender_intent: { type: Type.STRING },
                power_balance: { type: Type.STRING },
                risks: { type: Type.ARRAY, items: { type: Type.STRING } },
                paths: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                            logic: { type: Type.STRING },
                            impact: { type: Type.STRING },
                            suggestedObjective: { type: Type.STRING }
                        }
                    }
                }
            },
            required: ["sender_intent", "paths"]
        };
    } else if (task === 'generate_variations') {
        // تم استخدام Flash هنا لضمان عدم حدوث 429 المتكرر في Pro
        const { isReply, originalContent, objective, sender, receiver, subject, principles } = payload;
        systemInstruction += ` ولد 3 نسخ (محايدة، حازمة، دبلوماسية) بصيغة HTML. التخصيص: ${principles || 'رسمية'}`;
        prompt = isReply 
            ? `رد على الخطاب المرجعي التالي:\n[المحتوى المرجعي]: ${originalContent}\n[الهدف من الرد]: ${objective}\n[المرسل]: ${sender}\n[المستلم]: ${receiver}\n[الموضوع]: ${subject}`
            : `أنشئ خطاباً جديداً بالبيانات التالية:\n[الموضوع]: ${subject}\n[الهدف]: ${objective}\n[المرسل]: ${sender}\n[المستلم]: ${receiver}`;
        
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
    } else if (task === 'analyze_brief') {
        systemInstruction += " لخص الخطاب واستخرج النقاط الرئيسية.";
        prompt = `لخص هذا الخطاب:\nالموضوع: ${payload.subject}\nالمحتوى: ${payload.body}`;
        responseSchema = {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        };
    } else if (task === 'smart_replies') {
        systemInstruction += " اقترح 3 مسارات للرد على الخطاب الموفر.";
        prompt = `اقترح ردوداً على:\nالموضوع: ${payload.subject}\nالمحتوى: ${payload.body}`;
        responseSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    objective: { type: Type.STRING },
                    tone: { type: Type.STRING },
                    type: { type: Type.STRING }
                }
            }
        };
    } else if (task === 'enhance_letter') {
        systemInstruction += " حسن الصياغة وقدم اقتراحات تعديل واضحة.";
        prompt = `حسن صياغة النص التالي:\n${payload}`;
        responseSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    original_part: { type: Type.STRING },
                    suggested_improvement: { type: Type.STRING },
                    reason: { type: Type.STRING }
                }
            }
        };
    } else if (task === 'refine_chat') {
        const { currentBody, userInstruction, context: chatContext } = payload;
        systemInstruction += " عدل النص الموفر لغوياً وإدارياً وأعده بصيغة HTML.";
        prompt = `النص الحالي: ${currentBody}\nالسياق: ${chatContext}\nالتوجيه المطلوب: ${userInstruction}`;
        
        const resp = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: { systemInstruction }
        });
        return new Response(JSON.stringify({ text: resp.text }), { headers: { "Content-Type": "application/json" } });
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt || JSON.stringify(payload),
      config: {
          systemInstruction,
          responseMimeType: responseSchema ? "application/json" : undefined,
          responseSchema: responseSchema
      }
    });

    return new Response(response.text, { headers: { "Content-Type": "application/json" } });

  } catch (e: any) {
    const errorMsg = e.message || "";
    const isRateLimit = errorMsg.includes('429') || errorMsg.toLowerCase().includes('limit');
    
    return new Response(JSON.stringify({ 
        error: isRateLimit 
            ? "النظام مزدحم حالياً (تجاوز حد الطلبات المتزامنة). يرجى الانتظار ثوانٍ والمحاولة مرة أخرى." 
            : errorMsg 
    }), { 
        status: isRateLimit ? 429 : 500,
        headers: { "Content-Type": "application/json" }
    });
  }
}
