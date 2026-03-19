const nodemailer = require("nodemailer");

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

const appName = process.env.APP_NAME || "HireLink";
const fromAddress = `"${appName}" <${process.env.EMAIL_FROM}>`;
const supportEmail = process.env.EMAIL_FROM || "hirelinknp@gmail.com";

const wrapEmailLayout = ({ title, subtitle, accentColor, bodyHtml }) => `
  <div style="margin:0;padding:24px;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe5f0;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:0;">
          <div style="background:linear-gradient(135deg,#0f4fa8 0%,#0b72e7 100%);padding:20px 24px;">
            <div style="font-size:13px;letter-spacing:.6px;color:#d7e7ff;text-transform:uppercase;">${appName}</div>
            <div style="font-size:24px;font-weight:700;color:#ffffff;margin-top:6px;">${title}</div>
            <div style="font-size:14px;color:#e7f1ff;margin-top:6px;">${subtitle}</div>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <div style="height:4px;width:72px;background:${accentColor};border-radius:999px;margin-bottom:16px;"></div>
          ${bodyHtml}
          <div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5edf7;font-size:12px;color:#6b7c93;line-height:1.6;">
            This is an automated message from ${appName}. Please do not reply to this email.
          </div>
        </td>
      </tr>
    </table>
  </div>
`;

const sendUserBlockedEmail = async ({ toEmail, fullName, role }) => {
  try {
    const transporter = createTransporter();
    const roleLabel =
      String(role || "").toLowerCase() === "recruiter" ? "Recruiter" : "Candidate";

    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `${appName} - Account Blocked Notice`,
      html: wrapEmailLayout({
        title: "Account Blocked",
        subtitle: "Your profile access has been restricted by admin action.",
        accentColor: "#d73737",
        bodyHtml: `
          <p style="margin:0 0 12px;font-size:15px;color:#2a3a4d;line-height:1.7;">Hello <strong>${fullName || "User"}</strong>,</p>
          <p style="margin:0 0 16px;font-size:15px;color:#2a3a4d;line-height:1.7;">
            Your <strong>${roleLabel.toLowerCase()}</strong> account on <strong>${appName}</strong> has been blocked by an administrator.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #dbe5f0;border-radius:10px;background:#f8fbff;">
            <tr>
              <td style="padding:10px 12px;font-size:13px;color:#5e6f86;width:140px;">Account Type</td>
              <td style="padding:10px 12px;font-size:14px;color:#10253e;font-weight:600;">${roleLabel}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;font-size:13px;color:#5e6f86;border-top:1px solid #e5edf7;">Email</td>
              <td style="padding:10px 12px;font-size:14px;color:#10253e;font-weight:600;border-top:1px solid #e5edf7;">${toEmail}</td>
            </tr>
          </table>
          <div style="margin-top:16px;padding:12px 14px;border-radius:10px;background:#fff2f2;border:1px solid #ffd4d4;color:#8e2222;font-size:13px;line-height:1.6;">
            If you believe this action is incorrect, please contact support at <strong>${supportEmail}</strong>.
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

const sendUnblockAuditEmailToAdmin = async ({
  adminEmail,
  targetEmail,
  targetName,
  targetRole,
}) => {
  try {
    const transporter = createTransporter();
    const roleLabel =
      String(targetRole || "").toLowerCase() === "recruiter"
        ? "Recruiter"
        : "Candidate";

    await transporter.sendMail({
      from: fromAddress,
      to: adminEmail,
      subject: `${appName} - User Unblocked`,
      html: wrapEmailLayout({
        title: "User Unblocked",
        subtitle: "Admin audit log for account status change.",
        accentColor: "#1b9c5a",
        bodyHtml: `
          <p style="margin:0 0 16px;font-size:15px;color:#2a3a4d;line-height:1.7;">
            A user account has been successfully unblocked.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #dbe5f0;border-radius:10px;background:#f8fbff;">
            <tr>
              <td style="padding:10px 12px;font-size:13px;color:#5e6f86;width:140px;">Name</td>
              <td style="padding:10px 12px;font-size:14px;color:#10253e;font-weight:600;">${targetName || "User"}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;font-size:13px;color:#5e6f86;border-top:1px solid #e5edf7;">Email</td>
              <td style="padding:10px 12px;font-size:14px;color:#10253e;font-weight:600;border-top:1px solid #e5edf7;">${targetEmail || "-"}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;font-size:13px;color:#5e6f86;border-top:1px solid #e5edf7;">Role</td>
              <td style="padding:10px 12px;font-size:14px;color:#10253e;font-weight:600;border-top:1px solid #e5edf7;">${roleLabel}</td>
            </tr>
          </table>
          <div style="margin-top:16px;padding:12px 14px;border-radius:10px;background:#f1fbf5;border:1px solid #ccefd9;color:#1f6a3d;font-size:13px;line-height:1.6;">
            This audit copy was sent to <strong>${adminEmail}</strong> as requested.
          </div>
        `,
      }),
    });

    return true;
  } catch (error) {
    console.error("Error sending unblock audit email:", error);
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
    const transporter = createTransporter();
    const previousRoleLabel =
      String(previousRole || "").toLowerCase() === "recruiter"
        ? "Recruiter"
        : "Candidate";
    const newRoleLabel =
      String(newRole || "").toLowerCase() === "recruiter"
        ? "Recruiter"
        : "Candidate";

    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `${appName} - Account Role Updated`,
      html: wrapEmailLayout({
        title: "Role Updated",
        subtitle: "Your account role has been changed by admin.",
        accentColor: "#0b72e7",
        bodyHtml: `
          <p style="margin:0 0 12px;font-size:15px;color:#2a3a4d;line-height:1.7;">Hello <strong>${fullName || "User"}</strong>,</p>
          <p style="margin:0 0 16px;font-size:15px;color:#2a3a4d;line-height:1.7;">
            Your account role on <strong>${appName}</strong> has been updated.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #dbe5f0;border-radius:10px;background:#f8fbff;">
            <tr>
              <td style="padding:10px 12px;font-size:13px;color:#5e6f86;width:140px;">Previous Role</td>
              <td style="padding:10px 12px;font-size:14px;color:#10253e;font-weight:600;">${previousRoleLabel}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;font-size:13px;color:#5e6f86;border-top:1px solid #e5edf7;">New Role</td>
              <td style="padding:10px 12px;font-size:14px;color:#10253e;font-weight:600;border-top:1px solid #e5edf7;">${newRoleLabel}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;font-size:13px;color:#5e6f86;border-top:1px solid #e5edf7;">Email</td>
              <td style="padding:10px 12px;font-size:14px;color:#10253e;font-weight:600;border-top:1px solid #e5edf7;">${toEmail}</td>
            </tr>
          </table>
          <div style="margin-top:16px;padding:12px 14px;border-radius:10px;background:#edf5ff;border:1px solid #d1e3ff;color:#1e467c;font-size:13px;line-height:1.6;">
            If this was not expected, please contact support at <strong>${supportEmail}</strong>.
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
  sendUnblockAuditEmailToAdmin,
  sendUserRoleChangedEmail,
};
