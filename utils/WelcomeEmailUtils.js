const { sendEmail } = require("./mailSender");
const { buildEmailTemplate } = require("./emailTemplate");

const sendWelcomeEmail = async (email, fullName, role) => {
  try {
    const appName = process.env.APP_NAME || "HireLink";

    const userType = role === "candidate" ? "Candidate" : "Recruiter";
    const platformDescription =
      role === "candidate"
        ? "Apply for jobs, take assessments, and build your skill portfolio."
        : "Post jobs, review applicants, and manage your hiring process.";

    const mailOptions = {
      from: process.env.EMAIL_FROM || `${appName} <hirelinknp@gmail.com>`,
      to: email,
      subject: `Welcome to ${appName}!`,
      html: buildEmailTemplate({
        appName,
        title: `Welcome to ${appName}!`,
        introHtml: `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Hello <strong>${fullName}</strong>,</p>`,
        contentHtml: `
          <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Thank you for verifying your email and joining <strong>${appName}</strong>.</p>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Your account is now active as a <strong>${userType}</strong>.</p>
          <div style="background:#f4f7fc;border:1px solid #dbe5f0;border-radius:10px;padding:12px 14px;margin:14px 0;font-size:14px;line-height:1.7;">
            <strong>What you can do:</strong><br/>
            ${platformDescription}
          </div>
          <p style="margin:0;font-size:14px;line-height:1.7;">We are excited to have you onboard.</p>
        `,
      }),
    };

    await sendEmail(mailOptions);
    console.log(`Welcome email sent to: ${email} (${role})`);
    return true;
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return false;
  }
};

module.exports = { sendWelcomeEmail };
