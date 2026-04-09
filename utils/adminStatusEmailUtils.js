const { sendEmail } = require("./mailSender");
const { buildEmailTemplate } = require("./emailTemplate");

const appName = process.env.APP_NAME || "HireLink";
const fromAddress = process.env.EMAIL_FROM || `${appName} <hirelinknp@gmail.com>`;
const supportEmail = (process.env.EMAIL_FROM || "hirelinknp@gmail.com").replace(
  /^.*<([^>]+)>.*$/,
  "$1",
);

const sendUserBlockedEmail = async ({ toEmail, fullName, role }) => {
  try {
    const roleLabel =
      String(role || "").toLowerCase() === "recruiter" ? "Recruiter" : "Candidate";

    await sendEmail({
      from: fromAddress,
      to: toEmail,
      subject: `${appName} - Account Blocked Notice`,
      html: buildEmailTemplate({
        appName,
        title: "Account Blocked",
        introHtml: `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Hello <strong>${fullName || "User"}</strong>,</p>`,
        contentHtml: `
          <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Your <strong>${roleLabel.toLowerCase()}</strong> account has been blocked by an administrator.</p>
          <div style="background:#fff2f2;border:1px solid #ffd4d4;border-radius:10px;padding:12px 14px;margin:14px 0;color:#8e2222;font-size:13px;line-height:1.7;">
            If you think this is incorrect, contact support at <strong>${supportEmail}</strong>.
          </div>
        `,
      }),
    });

    return true;
  } catch (error) {
    console.error("Error sending blocked-email:", error);
    return false;
  }
};

const sendUserUnblockedEmail = async ({ toEmail, fullName, role }) => {
  try {
    const roleLabel =
      String(role || "").toLowerCase() === "recruiter" ? "Recruiter" : "Candidate";

    await sendEmail({
      from: fromAddress,
      to: toEmail,
      subject: `${appName} - Account Unblocked Notice`,
      html: buildEmailTemplate({
        appName,
        title: "Account Unblocked",
        introHtml: `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Hello <strong>${fullName || "User"}</strong>,</p>`,
        contentHtml: `
          <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Your <strong>${roleLabel.toLowerCase()}</strong> account has been unblocked.</p>
          <div style="background:#f1fbf5;border:1px solid #ccefd9;border-radius:10px;padding:12px 14px;margin:14px 0;color:#1f6a3d;font-size:13px;line-height:1.7;">
            You can now login and continue using your account.
          </div>
        `,
      }),
    });

    return true;
  } catch (error) {
    console.error("Error sending unblocked-email:", error);
    return false;
  }
};

const sendUserRoleChangedEmail = async ({
  toEmail,
  fullName,
  previousRole,
  newRole,
}) => {
  try {
    const previousRoleLabel =
      String(previousRole || "").toLowerCase() === "recruiter" ? "Recruiter" : "Candidate";
    const newRoleLabel =
      String(newRole || "").toLowerCase() === "recruiter" ? "Recruiter" : "Candidate";

    await sendEmail({
      from: fromAddress,
      to: toEmail,
      subject: `${appName} - Account Role Updated`,
      html: buildEmailTemplate({
        appName,
        title: "Role Updated",
        introHtml: `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Hello <strong>${fullName || "User"}</strong>,</p>`,
        contentHtml: `
          <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Your account role has been changed by an administrator.</p>
          <div style="background:#edf5ff;border:1px solid #d1e3ff;border-radius:10px;padding:12px 14px;margin:14px 0;color:#1e467c;font-size:13px;line-height:1.7;">
            Previous role: <strong>${previousRoleLabel}</strong><br/>
            New role: <strong>${newRoleLabel}</strong>
          </div>
        `,
      }),
    });

    return true;
  } catch (error) {
    console.error("Error sending role change email:", error);
    return false;
  }
};

module.exports = {
  sendUserBlockedEmail,
  sendUserUnblockedEmail,
  sendUserRoleChangedEmail,
};
