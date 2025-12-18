import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MailgunInboundEmail {
  recipient: string;
  sender: string;
  from: string;
  subject: string;
  "body-plain"?: string;
  "body-html"?: string;
  "stripped-text"?: string;
  "stripped-html"?: string;
  timestamp?: string;
}

interface SendGridInboundEmail {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const contentType = req.headers.get("content-type") || "";
    let emailData: {
      recipient: string;
      sender: string;
      subject: string;
      body: string;
      htmlBody: string;
    };

    // Parse based on content type (Mailgun uses form data, SendGrid uses JSON)
    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      // Mailgun format
      const formData = await req.formData();
      const mailgunData: MailgunInboundEmail = {
        recipient: formData.get("recipient") as string || "",
        sender: formData.get("sender") as string || "",
        from: formData.get("from") as string || "",
        subject: formData.get("subject") as string || "",
        "body-plain": formData.get("body-plain") as string || "",
        "body-html": formData.get("body-html") as string || "",
        "stripped-text": formData.get("stripped-text") as string || "",
        "stripped-html": formData.get("stripped-html") as string || "",
      };

      emailData = {
        recipient: mailgunData.recipient.toLowerCase(),
        sender: mailgunData.from || mailgunData.sender,
        subject: mailgunData.subject || "(No Subject)",
        body: mailgunData["stripped-text"] || mailgunData["body-plain"] || "",
        htmlBody: mailgunData["stripped-html"] || mailgunData["body-html"] || "",
      };

      console.log("Received Mailgun webhook:", { recipient: emailData.recipient, sender: emailData.sender, subject: emailData.subject });
    } else {
      // SendGrid or JSON format
      const jsonData = await req.json();
      
      // SendGrid sends an array of email objects
      const email = Array.isArray(jsonData) ? jsonData[0] : jsonData;
      
      emailData = {
        recipient: (email.to || email.envelope?.to?.[0] || "").toLowerCase(),
        sender: email.from || email.envelope?.from || "",
        subject: email.subject || "(No Subject)",
        body: email.text || "",
        htmlBody: email.html || "",
      };

      console.log("Received SendGrid/JSON webhook:", { recipient: emailData.recipient, sender: emailData.sender, subject: emailData.subject });
    }

    // Find the temp email by address
    const { data: tempEmail, error: findError } = await supabase
      .from("temp_emails")
      .select("id, is_active")
      .eq("address", emailData.recipient)
      .single();

    if (findError || !tempEmail) {
      console.log("Temp email not found:", emailData.recipient);
      // Return 200 to acknowledge receipt even if email not found
      // This prevents email providers from retrying
      return new Response(JSON.stringify({ status: "ignored", reason: "recipient not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tempEmail.is_active) {
      console.log("Temp email is inactive:", emailData.recipient);
      return new Response(JSON.stringify({ status: "ignored", reason: "recipient inactive" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert the received email
    const { data: insertedEmail, error: insertError } = await supabase
      .from("received_emails")
      .insert({
        temp_email_id: tempEmail.id,
        from_address: emailData.sender,
        subject: emailData.subject,
        body: emailData.body,
        html_body: emailData.htmlBody,
        is_read: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting email:", insertError);
      throw insertError;
    }

    console.log("Email saved successfully:", insertedEmail.id);

    return new Response(
      JSON.stringify({ 
        status: "success", 
        message: "Email received and stored",
        email_id: insertedEmail.id 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
