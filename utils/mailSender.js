const { BrevoClient } = require("@getbrevo/brevo");

const parseFrom = (fromValue = "") => {
  const fallback = {
    email: process.env.BREVO_SENDER_EMAIL || "hirelinknp@gmail.com",
    name: process.env.BREVO_SENDER_NAME || process.env.APP_NAME || "HireLink",
  };

  if (!fromValue || typeof fromValue !== "string") return fallback;

  const trimmed = fromValue.trim();
  const match = trimmed.match(/^(.*)<([^>]+)>$/);
  if (match) {
    const name = String(match[1] || "").trim().replace(/^"|"$/g, "");
    const email = String(match[2] || "").trim();
    if (email) {
      return {
        email,
        name: name || fallback.name,
      };
    }
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return {
      email: trimmed,
      name: fallback.name,
    };
  }

  return fallback;
};

const resolveFrom = () => {
  const appName = process.env.APP_NAME || "HireLink";
  const fallback = `${appName} <hirelinknp@gmail.com>`;
  const brevoFrom = process.env.BREVO_SENDER_EMAIL
    ? `${process.env.BREVO_SENDER_NAME || appName} <${process.env.BREVO_SENDER_EMAIL}>`
    : "";

  return (process.env.EMAIL_FROM || brevoFrom || fallback).trim();
};

const sendWithBrevo = async ({ to, subject, html, from }) => {
  const apiKey = String(process.env.BREVO_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("BREVO_API_KEY is missing");
  }

  const sender = parseFrom(from || resolveFrom());
  const client = new BrevoClient({ apiKey });

  return client.transactionalEmails.sendTransacEmail({
    subject,
    htmlContent: html,
    sender,
    to: [{ email: to }],
  });
};

const sendEmail = async ({ to, subject, html, from }) => {
  try {
    return await sendWithBrevo({ to, subject, html, from });
  } catch (error) {
    const details = {
      message: error?.message || "",
      statusCode: error?.statusCode || error?.status || "",
      body: error?.body || null,
      rawResponseBody: error?.rawResponse?.body || null,
      rawResponseText: error?.rawResponse?.text || "",
    };

    console.error("Brevo detailed error:", JSON.stringify(details, null, 2));

    const errorBody =
      (error &&
        (error.body ||
          error.rawResponse?.body ||
          error.message ||
          error.toString())) ||
      "Unknown Brevo error";

    const errorText =
      typeof errorBody === "string"
        ? errorBody
        : JSON.stringify(errorBody);

    throw new Error(
      `Brevo send failed: ${errorText}`
    );
  }
};

module.exports = {
  sendEmail,
  resolveFrom,
};
