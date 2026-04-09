const { sendEmail } = require("./mailSender");
const { buildEmailTemplate, buildCodeCard } = require("./emailTemplate");

const sendVerificationEmail = async (email, verificationCode) => {
  try {
    const appName = process.env.APP_NAME || "HireLink";

    const mailOptions = {
      from: process.env.EMAIL_FROM || `${appName} <hirelinknp@gmail.com>`,
      to: email,
      subject: `${appName} - Email Verification Code`,
      html: buildEmailTemplate({
        appName,
        title: "Verify Your Email Address",
        introHtml:
          "<p style='margin:0 0 12px;font-size:15px;line-height:1.7;'>Thank you for registering. Please use this verification code to complete your signup.</p>",
        contentHtml: `
          ${buildCodeCard(verificationCode)}
          <p style="margin:0 0 8px;font-size:14px;line-height:1.7;">Enter this code on the verification page to complete your registration.</p>
          <p style="margin:0;font-size:14px;line-height:1.7;"><strong>This code will expire in 15 minutes.</strong></p>
        `,
        noteHtml:
          "<p style='margin:18px 0 0;font-size:13px;color:#5f6f84;'>If you did not create an account, you can ignore this email.</p>",
      }),
    };

    await sendEmail(mailOptions);
    console.log(`Verification email sent to: ${email}`);
    return true;
  } catch (error) {
    console.error("Error sending verification email:", error);
    return false;
  }
};

module.exports = { sendVerificationEmail };

