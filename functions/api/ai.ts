
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
    let modelName = "gemini-3-flash-preview"; 
    let responseSchema: any = undefined;
    let systemInstruction = `أنت خبير استراتيجيات إدارية عربي رفيع المستوى. ${ARABIC_STRICT_PROTOCOL}`;

    if (task === 'analyze_strategy') {
        systemInstruction += " حلل الخطاب وحدد النوايا وميزان القوة و3 مسارات للرد.";
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
        modelName = "gemini-3-pro-preview";
        const { isReply, originalContent, objective, sender, receiver, subject, strategy_logic } = payload;
        systemInstruction += ` ولد 3 نسخ (محايدة، حازمة، دبلوماسية) HTML. الاستراتيجية: ${strategy_logic || 'رسمية'}`;
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
        responseSchema = {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        };
    } else if (task === 'smart_replies') {
        systemInstruction += " اقترح 3 مسارات للرد على الخطاب الموفر.";
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
        const resp = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `النص: ${currentBody}\nالسياق: ${chatContext}\nالتوجيه: ${userInstruction}`,
            config: { systemInstruction: systemInstruction + " عدل النص الموفر لغوياً وإدارياً وأعده بصيغة HTML." }
        });
        return new Response(JSON.stringify({ text: resp.text }), { headers: { "Content-Type": "application/json" } });
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: typeof payload === 'string' ? payload : JSON.stringify(payload),
      config: {
          systemInstruction,
          responseMimeType: responseSchema ? "application/json" : undefined,
          responseSchema: responseSchema
      }
    });

    return new Response(response.text, { headers: { "Content-Type": "application/json" } });

  } catch (e: any) {
    const isQuota = e.message?.includes('429');
    return new Response(JSON.stringify({ error: isQuota ? "تجاوزت حد الكوتا اليومي." : e.message }), { 
        status: isQuota ? 429 : 500,
        headers: { "Content-Type": "application/json" }
    });
  }
}
