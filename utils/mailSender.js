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
  const fallback = "HireLink <hirelinknp@gmail.com>";
  return (process.env.EMAIL_FROM || fallback).trim();
};

const sendEmail = async ({ to, subject, html, from }) => {
  const transporter = createSmtpTransporter();
  return transporter.sendMail({
    from: from || resolveFrom(),
    to,
    subject,
    html,
  });
};

module.exports = {
  sendEmail,
  resolveFrom,
};
