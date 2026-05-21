import { Request, Response } from 'express';
import { Resend } from 'resend';

export const sendContactEmail = async (req: Request, res: Response) => {
  const { name, email, query } = req.body;

  if (!name || !query) {
    return res.status(400).json({
      status: 'error',
      message: 'Name and query are required'
    });
  }

  // Strip any accidental quotes or whitespace from env vars
  const resendApiKey = (process.env.RESEND_API_KEY || '').replace(/^["']|["']$/g, '').trim();

  if (!resendApiKey) {
    console.warn('[Contact] Missing RESEND_API_KEY. Skipping email.');
    return res.status(200).json({
      status: 'success',
      message: 'Message received (credentials not configured)'
    });
  }

  try {
    const resend = new Resend(resendApiKey);

    // Resend requires the 'from' address to be onboarding@resend.dev unless you verify a custom domain.
    // It also restricts 'to' addresses to your registered Resend email address unless you verify a domain.
    const { data, error } = await resend.emails.send({
      from: 'NeoPlane Contact Form <onboarding@resend.dev>',
      to: 'affanahmedkhan34@gmail.com',
      subject: `NeoPlane Contact Form: Message from ${name}`,
      replyTo: email || undefined,
      text: `
Name: ${name}
Email: ${email || 'Not provided'}

Message/Query:
${query}
      `,
    });

    if (error) {
      console.error('[Contact Error]', error);
      return res.status(200).json({
        status: 'error',
        message: `Email failed: ${error.message}`
      });
    }

    console.log('[Contact] Email sent successfully via Resend. ID:', data?.id);

    return res.status(200).json({
      status: 'success',
      message: 'Email sent successfully'
    });
  } catch (error: any) {
    console.error('[Contact Error]', error?.message || error);
    return res.status(200).json({
      status: 'error',
      message: `Email failed: ${error?.message || 'Unknown error'}`
    });
  }
};
