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

  // Diagnostic logging (masked)
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  
  if (gmailUser && gmailPass) {
    console.log(`[Contact] Attempting to send email via ${gmailUser} (Password configured)`);
  } else {
    console.warn('[Contact] Missing credentials. GMAIL_USER:', !!gmailUser, 'GMAIL_APP_PASSWORD:', !!gmailPass);
  }

  try {
    // Basic transporter configuration
    // IMPORTANT: Users must set GMAIL_USER and GMAIL_APP_PASSWORD in .env
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // Use SSL/TLS
      auth: {
        user: gmailUser || 'affanahmedkhan34@gmail.com',
        pass: gmailPass, 
      },
    });

    const mailOptions = {
      from: `NeoPlane <${gmailUser || 'affanahmedkhan34@gmail.com'}>`,
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

    // If GMAIL_APP_PASSWORD is not set, we simulate success for dev purposes
    if (!gmailPass) {
      console.warn('[Contact] GMAIL_APP_PASSWORD not set. Email sending skipped (simulated success).');
      return res.status(200).json({
        status: 'success',
        message: 'Message received (Development Mode: No credentials set)'
      });
    }

    await transporter.sendMail(mailOptions);
    console.log('[Contact] Email sent successfully to affanahmedkhan34@gmail.com');

    return res.status(200).json({
      status: 'success',
      message: 'Email sent successfully'
    });
  } catch (error) {
    console.error('[Contact Error]', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to send email. Please ensure your Gmail App Password is correct.'
    });
  }
};
