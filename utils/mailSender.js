const nodemailer = require("nodemailer");

const createSmtpTransporter = () => {
  const port = Number(process.env.EMAIL_PORT || 587);
  const secure =
    String(process.env.EMAIL_SECURE || "").toLowerCase() === "true" ||
    port === 465;

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure,
    requireTLS: !secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
};

const resolveFrom = () => {
  const fallback = "HireLink <onboarding@resend.dev>";
  return (process.env.EMAIL_FROM || fallback).trim();
};

const sendViaResend = async ({ to, subject, html, from }) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is missing");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: from || resolveFrom(),
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }

  return response.json();
};

const sendViaSmtp = async ({ to, subject, html, from }) => {
  const transporter = createSmtpTransporter();
  return transporter.sendMail({
    from: from || resolveFrom(),
    to,
    subject,
    html,
  });
};

const sendEmail = async ({ to, subject, html, from }) => {
  if (process.env.RESEND_API_KEY) {
    return sendViaResend({ to, subject, html, from });
  }
  return sendViaSmtp({ to, subject, html, from });
};

module.exports = {
  sendEmail,
  resolveFrom,
};
