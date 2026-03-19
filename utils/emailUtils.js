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

const sendVerificationEmail = async (email, verificationCode) => {
  try {
    const transporter = createTransporter();
    const appName = process.env.APP_NAME || "HireLink";

    const mailOptions = {
      from: `"${appName}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: `${appName} - Email Verification Code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #0068ce; margin: 0;">${appName}</h1>
          </div>
          
          <h3>Verify Your Email Address</h3>
          <p>Thank you for registering! Please use the following verification code to complete your registration:</p>
          
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #0068ce; letter-spacing: 10px; margin: 0; font-size: 32px;">${verificationCode}</h1>
          </div>
          
          <p>Enter this code on the verification page to complete your registration.</p>
          <p><strong>This code will expire in 15 minutes.</strong></p> <!-- CHANGED: 15 minutes -->
          
          <p>If you didn't create an account with ${appName}, please ignore this email.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          
          <p style="color: #666; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ${appName}. All rights reserved.<br/>
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to: ${email}`);
    return true;
  } catch (error) {
    console.error("Error sending verification email:", error);
    return false;
  }
};

module.exports = { sendVerificationEmail };
