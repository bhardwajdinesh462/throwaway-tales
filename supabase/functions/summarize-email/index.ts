import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, body, htmlBody } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Use plain text body, or strip HTML if only HTML is available
    let emailContent = body || '';
    if (!emailContent && htmlBody) {
      // Simple HTML stripping
      emailContent = htmlBody
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    const systemPrompt = `You are an email analysis assistant. Analyze the email and extract key information.
Your response MUST be valid JSON with this exact structure:
{
  "summary": "2-3 sentence summary of the email",
  "otpCodes": ["any OTP codes, verification codes, or one-time passwords found"],
  "importantLinks": [{"text": "link description", "url": "the URL"}],
  "actionItems": ["any actions the recipient should take"],
  "sender_intent": "brief description of what the sender wants"
}

Rules:
- OTP codes include: 6-digit codes, verification codes, confirmation codes, security codes
- Important links include: verification links, password reset links, confirmation links, unsubscribe links
- Be concise and accurate
- If no OTPs or links found, return empty arrays`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Subject: ${subject || '(No Subject)'}\n\nEmail Body:\n${emailContent.substring(0, 8000)}` }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    // Parse JSON from AI response
    let parsed;
    try {
      // Try to extract JSON from the response (in case it's wrapped in markdown code blocks)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(aiResponse);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      // Return a basic summary if parsing fails
      parsed = {
        summary: aiResponse.substring(0, 500),
        otpCodes: [],
        importantLinks: [],
        actionItems: [],
        sender_intent: 'Unable to determine'
      };
    }

    console.log('[summarize-email] Successfully analyzed email');
    
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in summarize-email:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to summarize email' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
