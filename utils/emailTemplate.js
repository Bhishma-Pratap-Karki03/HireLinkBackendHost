const buildEmailTemplate = ({ appName, title, introHtml, contentHtml, noteHtml = "" }) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#1c2f46;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe5f0;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:0;">
          <div style="background:linear-gradient(135deg,#0f4fa8 0%,#0b72e7 100%);padding:20px 24px;">
            <div style="font-size:13px;letter-spacing:.6px;color:#d7e7ff;text-transform:uppercase;">${appName}</div>
            <div style="font-size:24px;font-weight:700;color:#ffffff;margin-top:6px;">${title}</div>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          ${introHtml}
          ${contentHtml}
          ${noteHtml}
          <div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5edf7;font-size:12px;color:#6b7c93;line-height:1.7;text-align:center;">
            &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.<br/>
            This is an automated message, please do not reply to this email.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const buildCodeCard = (code) => `
  <div style="background:#f4f7fc;padding:16px 20px;text-align:center;margin:18px 0;border-radius:10px;border:1px solid #dbe5f0;">
    <div style="color:#0b72e7;letter-spacing:10px;font-size:32px;font-weight:700;">${code}</div>
  </div>
`;

module.exports = {
  buildEmailTemplate,
  buildCodeCard,
};

