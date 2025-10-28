const nodemailer = require('nodemailer');

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error('[mailer] Missing SMTP_* env variables');
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, 
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

const transport = createTransport();

async function send({ to, subject, text, html }) {
  await transport.sendMail({
    from: process.env.FROM_EMAIL || process.env.SMTP_USER,
    to,
    subject,
    text,
    html
  });
}

function apptDetailsBlock(appt) {
  if (!appt) return '';
  const lines = [
    appt.serviceType ? `<div><strong>Service:</strong> ${appt.serviceType}</div>` : '',
    appt.date ? `<div><strong>Date:</strong> ${appt.date}</div>` : '',
    appt.time ? `<div><strong>Time:</strong> ${appt.time}</div>` : '',
    appt.petName ? `<div><strong>Pet:</strong> ${appt.petName}</div>` : ''
  ].filter(Boolean).join('');
  return lines ? `<hr/>${lines}` : '';
}

async function sendAppointmentConfirmed({ to, appt }) {
  const subject = 'Your Le Veto appointment is confirmed';
  const html = `
    <p>Hello,</p>
    <p>Your appointment has been <strong>confirmed</strong>. We look forward to seeing you.</p>
    ${apptDetailsBlock(appt)}
    <p>— Le Veto Clinic</p>
  `;
  await send({ to, subject, text: 'Your appointment has been confirmed.', html });
}

async function sendAppointmentCancelled({ to, appt }) {
  const subject = 'Your Le Veto appointment was cancelled';
  const html = `
    <p>Hello,</p>
    <p>Your appointment has been <strong>cancelled</strong>. If this was unexpected, please rebook from our website.</p>
    ${apptDetailsBlock(appt)}
    <p>— Le Veto Clinic</p>
  `;
  await send({ to, subject, text: 'Your appointment was cancelled.', html });
}

module.exports = { sendAppointmentConfirmed, sendAppointmentCancelled };
