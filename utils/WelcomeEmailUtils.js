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

const sendWelcomeEmail = async (email, fullName, role) => {
  try {
    const transporter = createTransporter();
    const appName = process.env.APP_NAME || "HireLink";

    // Determine user role for personalized message
    const userType = role === "candidate" ? "Candidate" : "Recruiter";
    const platformDescription =
      role === "candidate"
        ? "Apply for jobs, take assessments, and build your skill portfolio"
        : "Post job vacancies, hire candidates, and manage your recruitment process";

    const mailOptions = {
      from: `"${appName}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: `Welcome to ${appName}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #0068ce; margin: 0;">Welcome to ${appName}!</h1>
          </div>
          
          <p>Hello <strong>${fullName}</strong>,</p>
          
          <p>Thank you for verifying your email address and joining <strong>${appName}</strong>!</p>
          
          <p>You are now registered as a <strong>${userType}</strong>. Welcome to our smart job and skill portfolio platform!</p>
          
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>As a ${userType}, you can:</strong></p>
            <p>${platformDescription}</p>
          </div>
          
          <p>We're excited to have you on board! Start exploring the platform features that match your needs.</p>
          
          <p>If you have any questions, feel free to contact our support team.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          
          <p style="color: #666; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ${appName}. All rights reserved.<br/>
            This is an automated welcome message.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to: ${email} (${role})`);
    return true;
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return false;
  }
};

module.exports = { sendWelcomeEmail };
