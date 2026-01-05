
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
    // استخدام Pro للمهام الاستراتيجية و Flash للمهام السريعة
    const modelName = task === 'analyze_strategy' ? "gemini-3-pro-preview" : "gemini-3-flash-preview"; 
    
    let responseSchema: any = undefined;
    let systemInstruction = `أنت خبير استراتيجيات إدارية عربي رفيع المستوى. ${ARABIC_STRICT_PROTOCOL}`;
    let prompt = "";

    if (task === 'analyze_strategy') {
        systemInstruction += " حلل الخطاب وحدد النوايا وميزان القوة و3 مسارات للرد واستخلص المخاطر الإدارية.";
        prompt = `حلل الخطاب التالي استراتيجياً:\nالموضوع: ${payload.subject}\nالمحتوى: ${payload.body}`;
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
                            suggestedObjective: { type: Type.STRING }
                        }
                    }
                }
            },
            required: ["sender_intent", "risks", "paths"]
        };
    } else if (task === 'generate_variations') {
        const { isReply, originalContent, objective, sender, receiver, subject, principles } = payload;
        systemInstruction += ` ولد 3 نسخ (محايدة، حازمة، دبلوماسية) بصيغة HTML. التخصيص: ${principles || 'رسمية'}`;
        prompt = isReply 
            ? `رد على الخطاب المرجعي:\n[المحتوى المرجعي]: ${originalContent}\n[الهدف]: ${objective}\n[المرسل]: ${sender}\n[المستلم]: ${receiver}`
            : `أنشئ خطاباً جديداً:\n[الموضوع]: ${subject}\n[الهدف]: ${objective}\n[المرسل]: ${sender}\n[المستلم]: ${receiver}`;
        
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
        systemInstruction += " لخص الخطاب واستخرج النقاط الرئيسية بدقة.";
        prompt = `لخص هذا الخطاب:\nالموضوع: ${payload.subject}\nالمحتوى: ${payload.body}`;
        responseSchema = {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["summary", "keyPoints"]
        };
    } else if (task === 'smart_replies') {
        systemInstruction += " اقترح 3 مسارات للرد على الخطاب الموفر.";
        prompt = `اقترح ردوداً استراتيجية على:\nالموضوع: ${payload.subject}\nالمحتوى: ${payload.body}`;
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
        systemInstruction += " مراجع لغوي وإداري. حسن الصياغة وقدم اقتراحات واضحة.";
        prompt = `راجع النص التالي:\n${payload}`;
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
        systemInstruction += " عدل النص بناءً على توجيهات المستخدم وأعده بصيغة HTML.";
        prompt = `النص: ${currentBody}\nالتوجيه: ${userInstruction}\nالسياق: ${chatContext}`;
        
        const resp = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: { systemInstruction }
        });
        return new Response(JSON.stringify({ text: resp.text }), { headers: { "Content-Type": "application/json" } });
    } else if (task === 'follow_up') {
        prompt = `من هذه القائمة، ما المعاملات المعلقة؟ ${JSON.stringify(payload)}`;
        responseSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    letterId: { type: Type.STRING },
                    summary: { type: Type.STRING }
                }
            }
        };
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
            ? "النظام مزدحم حالياً. يرجى المحاولة بعد ثوانٍ." 
            : errorMsg 
    }), { 
        status: isRateLimit ? 429 : 500,
        headers: { "Content-Type": "application/json" }
    });
  }
}
