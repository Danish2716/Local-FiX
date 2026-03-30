const nodemailer = require('nodemailer');

const createTransporter = () => {
  // Gmail transporter
  if (process.env.EMAIL_SERVICE === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  // Generic SMTP transporter
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || process.env.EMAIL_USER,
      pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
    },
  });
};

const sendOTPEmail = async (email, otp, name = 'User') => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"LocalFix 🔧" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `${otp} - Your LocalFix OTP`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: 'Inter', Arial, sans-serif; background: #F4F6FB; margin: 0; padding: 20px; }
          .container { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #2DBE6C, #1A9E52); padding: 32px 28px; text-align: center; }
          .header h1 { color: #fff; font-size: 28px; margin: 0; font-weight: 800; letter-spacing: -0.5px; }
          .header p { color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 14px; }
          .body { padding: 32px 28px; }
          .otp-box { background: #E8F8EE; border: 2px solid #C6EFDA; border-radius: 14px; text-align: center; padding: 24px; margin: 24px 0; }
          .otp { font-size: 42px; font-weight: 800; color: #1A9E52; letter-spacing: 10px; }
          .otp-label { font-size: 13px; color: #6B7090; margin-top: 8px; }
          .timer { font-size: 13px; color: #FF4757; font-weight: 600; margin-top: 4px; }
          .warning { background: #FFF3E8; border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #E65100; margin-top: 16px; }
          .footer { text-align: center; padding: 20px 28px; border-top: 1px solid #E8E8F0; }
          .footer p { font-size: 12px; color: #A0A5C0; margin: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔧 LocalFix</h1>
            <p>Home services, at your doorstep</p>
          </div>
          <div class="body">
            <p style="font-size:16px;color:#1A1D2E;font-weight:600;">Hi ${name} 👋</p>
            <p style="font-size:14px;color:#6B7090;line-height:1.7;">
              Here's your One-Time Password (OTP) for LocalFix verification. 
              Please do not share this with anyone.
            </p>
            <div class="otp-box">
              <div class="otp">${otp}</div>
              <div class="otp-label">Your verification code</div>
              <div class="timer">⏱ Expires in 5 minutes</div>
            </div>
            <div class="warning">
              ⚠️ If you did not request this OTP, please ignore this email. 
              Your account is safe.
            </div>
          </div>
          <div class="footer">
            <p>LocalFix · Trusted home services near you</p>
            <p style="margin-top:4px;">© 2024 LocalFix. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`📧 OTP email sent to ${email}: ${info.messageId}`);
  return info;
};

module.exports = { sendOTPEmail };
