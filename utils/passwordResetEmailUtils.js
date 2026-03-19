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

const sendPasswordResetEmail = async (email, resetCode) => {
  try {
    const transporter = createTransporter();
    const appName = process.env.APP_NAME || "HireLink";

    const mailOptions = {
      from: `"${appName}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: `${appName} - Password Reset Code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #0068ce; margin: 0;">${appName}</h1>
          </div>
          
          <h3>Password Reset Request</h3>
          <p>We received a request to reset your password. Use the following code to reset your password:</p>
          
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #0068ce; letter-spacing: 10px; margin: 0; font-size: 32px;">${resetCode}</h1>
          </div>
          
          <p>Enter this code on the password reset page to continue.</p>
          <p><strong>This code will expire in 15 minutes.</strong></p>
          
          <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          
          <p style="color: #666; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ${appName}. All rights reserved.<br/>
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to: ${email}`);
    return true;
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return false;
  }
};

const sendPasswordChangedEmail = async (email, fullName) => {
  try {
    const transporter = createTransporter();
    const appName = process.env.APP_NAME || "HireLink";

    const mailOptions = {
      from: `"${appName}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: `${appName} - Password Changed Successfully`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #0068ce; margin: 0;">${appName}</h1>
          </div>
          
          <h3>Password Changed Successfully</h3>
          <p>Hello <strong>${fullName}</strong>,</p>
          
          <p>Your password has been changed successfully.</p>
          
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Security Notice:</strong></p>
            <p>If you did not make this change, please contact our support team immediately.</p>
          </div>
          
          <p>You can now login with your new password.</p>
          
          <p>Thank you for keeping your account secure!</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          
          <p style="color: #666; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ${appName}. All rights reserved.<br/>
            This is an automated security message.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Password changed email sent to: ${email}`);
    return true;
  } catch (error) {
    console.error("Error sending password changed email:", error);
    return false;
  }
};

module.exports = { sendPasswordResetEmail, sendPasswordChangedEmail };
