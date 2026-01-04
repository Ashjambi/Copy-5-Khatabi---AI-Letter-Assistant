
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Cloudflare Pages Function: /api/ai
 * بوابة مركزية لمعالجة مهام الذكاء الاصطناعي (الردود، التحليل، التلخيص).
 */
export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { task, payload, config: clientConfig } = body;
    
    // جلب المفتاح من أسرار Cloudflare (Secrets)
    const apiKey = env.API_KEY || env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API_KEY_NOT_FOUND_IN_BACKEND" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // إرسال الطلب إلى Gemini 3 Flash
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: payload,
      config: clientConfig || {}
    });

    return new Response(response.text, {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
    });
  }
}
