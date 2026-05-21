import { Request, Response } from 'express';
import nodemailer from 'nodemailer';

export const sendContactEmail = async (req: Request, res: Response) => {
  const { name, email, query } = req.body;

  if (!name || !query) {
    return res.status(400).json({
      status: 'error',
      message: 'Name and query are required'
    });
  }

  // Strip any accidental quotes or whitespace from env vars (common Render issue)
  const gmailUser = (process.env.GMAIL_USER || '').replace(/^["']|["']$/g, '').trim();
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || '').replace(/^["']|["']$/g, '').trim();

  console.log(`[Contact] GMAIL_USER present: ${!!gmailUser}, GMAIL_APP_PASSWORD present: ${!!gmailPass}, pass length: ${gmailPass.length}`);

  if (!gmailUser || !gmailPass) {
    console.warn('[Contact] Missing credentials. Skipping email.');
    return res.status(200).json({
      status: 'success',
      message: 'Message received (credentials not configured)'
    });
  }

  try {
    // Use port 587 with STARTTLS - more compatible with cloud providers like Render
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    // Verify connection first
    await transporter.verify();
    console.log('[Contact] SMTP connection verified successfully');

    const mailOptions = {
      from: `NeoPlane <${gmailUser}>`,
      to: 'affanahmedkhan34@gmail.com',
      subject: `NeoPlane Contact Form: Message from ${name}`,
      text: `
        Name: ${name}
        Email: ${email || 'Not provided'}
        
        Message/Query:
        ${query}
      `,
      replyTo: email || undefined
    };

    await transporter.sendMail(mailOptions);
    console.log('[Contact] Email sent successfully');

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
