import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  token: string;
  action: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let requestBody: VerifyRequest;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { token, action } = requestBody;

    if (!token) {
      console.log('No token provided in request');
      return new Response(
        JSON.stringify({ success: false, error: "No token provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Verifying reCAPTCHA for action: ${action}, token length: ${token.length}`);

    // Get captcha settings from database
    const { data: settingsData, error: settingsError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'captcha_settings')
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching captcha settings:', settingsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch captcha settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settingsData?.value) {
      // Captcha not configured, allow through
      console.log('Captcha not configured, allowing request');
      return new Response(
        JSON.stringify({ success: true, score: 1.0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const settings = settingsData.value as {
      enabled: boolean;
      provider: string;
      secretKey: string;
      threshold: number;
    };

    console.log('Captcha settings loaded:', {
      enabled: settings.enabled,
      provider: settings.provider,
      hasSecretKey: !!settings.secretKey,
      secretKeyLength: settings.secretKey?.length || 0,
      threshold: settings.threshold,
    });

    if (!settings.enabled) {
      console.log('Captcha disabled, allowing request');
      return new Response(
        JSON.stringify({ success: true, score: 1.0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.secretKey) {
      // FAIL-SAFE: If captcha is enabled but misconfigured, allow through with warning
      console.warn('⚠️ Captcha enabled but no secret key configured - allowing request (misconfigured)');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "misconfigured - no secret key" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify with Google reCAPTCHA
    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const verifyBody = `secret=${encodeURIComponent(settings.secretKey)}&response=${encodeURIComponent(token)}`;
    
    console.log('Calling Google reCAPTCHA API...');
    
    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyBody,
    });

    if (!verifyResponse.ok) {
      console.error('Google reCAPTCHA API returned error status:', verifyResponse.status);
      return new Response(
        JSON.stringify({ success: false, error: "reCAPTCHA API error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const verifyData = await verifyResponse.json();
    
    console.log('reCAPTCHA verification result:', {
      success: verifyData.success,
      score: verifyData.score,
      action: verifyData.action,
      expectedAction: action,
      threshold: settings.threshold,
      hostname: verifyData.hostname,
      errorCodes: verifyData['error-codes'],
    });

    if (!verifyData.success) {
      const errorCodes = verifyData['error-codes'] || [];
      console.error('reCAPTCHA verification failed with error codes:', errorCodes);
      
      // FAIL-SAFE: If secret key is invalid, allow through with warning (misconfigured)
      if (errorCodes.includes('invalid-input-secret')) {
        console.warn('⚠️ Invalid reCAPTCHA secret key - allowing request (misconfigured)');
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "misconfigured - invalid secret key" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Provide more specific error messages for user-fixable errors
      let errorMessage = "reCAPTCHA verification failed";
      if (errorCodes.includes('invalid-input-response')) {
        errorMessage = "Invalid reCAPTCHA token - please try again";
      } else if (errorCodes.includes('timeout-or-duplicate')) {
        errorMessage = "reCAPTCHA token expired - please try again";
      } else if (errorCodes.includes('bad-request')) {
        errorMessage = "Bad reCAPTCHA request - please refresh and try again";
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          errors: errorCodes,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check score threshold (reCAPTCHA v3)
    const score = verifyData.score || 0;
    const threshold = settings.threshold || 0.5;
    
    if (score < threshold) {
      console.log(`reCAPTCHA score ${score} below threshold ${threshold}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Suspicious activity detected. Please try again.",
          score,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify action matches (optional but logged)
    if (action && verifyData.action !== action) {
      console.warn(`Action mismatch: expected ${action}, got ${verifyData.action}`);
    }

    console.log(`reCAPTCHA verification successful! Score: ${score}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        score,
        action: verifyData.action,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error verifying reCAPTCHA:", error);
    const message = error instanceof Error ? error.message : "Verification failed";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
