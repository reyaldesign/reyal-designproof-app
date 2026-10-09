import nodemailer from 'nodemailer';

export async function notify(subject: string, text: string, recipients?: string[]) {
  const to = recipients?.length ? recipients.join(', ') : process.env.NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
  if (!process.env.SMTP_HOST || !to) return console.log(`[mail disabled] ${subject}\n${text}`);
  try {
    await nodemailer
      .createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
      .sendMail({ from: process.env.MAIL_FROM || to, to, subject, text });
  } catch (e) {
    console.error('mail failed', e); // never fail a client's Send because email is down
  }
}
