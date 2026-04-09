const { sendEmail } = require("./mailSender");
const { buildEmailTemplate, buildCodeCard } = require("./emailTemplate");

const sendPasswordResetEmail = async (email, resetCode) => {
  try {
    const appName = process.env.APP_NAME || "HireLink";

    const mailOptions = {
      from: process.env.EMAIL_FROM || `${appName} <hirelinknp@gmail.com>`,
      to: email,
      subject: `${appName} - Password Reset Code`,
      html: buildEmailTemplate({
        appName,
        title: "Password Reset Request",
        introHtml:
          "<p style='margin:0 0 12px;font-size:15px;line-height:1.7;'>We received a request to reset your password. Use this code to continue.</p>",
        contentHtml: `
          ${buildCodeCard(resetCode)}
          <p style="margin:0 0 8px;font-size:14px;line-height:1.7;">Enter this code on the reset-password page.</p>
          <p style="margin:0;font-size:14px;line-height:1.7;"><strong>This code will expire in 15 minutes.</strong></p>
        `,
        noteHtml:
          "<p style='margin:18px 0 0;font-size:13px;color:#5f6f84;'>If you did not request this, you can ignore this email.</p>",
      }),
    };

    await sendEmail(mailOptions);
    console.log(`Password reset email sent to: ${email}`);
    return true;
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return false;
  }
};

const sendPasswordChangedEmail = async (email, fullName) => {
  try {
    const appName = process.env.APP_NAME || "HireLink";

    const mailOptions = {
      from: process.env.EMAIL_FROM || `${appName} <hirelinknp@gmail.com>`,
      to: email,
      subject: `${appName} - Password Changed Successfully`,
      html: buildEmailTemplate({
        appName,
        title: "Password Changed Successfully",
        introHtml: `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Hello <strong>${fullName}</strong>,</p>`,
        contentHtml: `
          <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Your password has been changed successfully.</p>
          <div style="background:#fff7e8;border:1px solid #ffe3ac;border-radius:10px;padding:12px 14px;margin:14px 0;color:#7a5900;font-size:13px;line-height:1.7;">
            <strong>Security Notice:</strong> If this was not you, please contact support immediately.
          </div>
        `,
      }),
    };

    await sendEmail(mailOptions);
    console.log(`Password changed email sent to: ${email}`);
    return true;
  } catch (error) {
    console.error("Error sending password changed email:", error);
    return false;
  }
};

module.exports = { sendPasswordResetEmail, sendPasswordChangedEmail };
