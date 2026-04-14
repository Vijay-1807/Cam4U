
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import path from 'path';

// Create reusable transporter object using Gmail SMTP
const createTransporter = () => {
  // In a real app, use environment variables
  // process.env.EMAIL_USER and process.env.EMAIL_PASS
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('EMAIL_USER or EMAIL_PASS environment variables are missing!');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER, // Your Gmail address
      pass: process.env.EMAIL_PASS  // Your Gmail App Password
    }
  });
};

// Generate verification token
export const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Generate a 6-digit numeric code as string
export const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send verification email
export const sendVerificationEmail = async (email: string, name: string, verificationToken: string) => {
  try {
    const transporter = createTransporter();
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    const mailOptions = {
      from: `"Cam4U" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - Cam4U',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome!</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your Digital Platform</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Hi ${name}!</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Thank you for registering! To complete your registration, 
              please verify your email address by clicking the button below.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; 
                        font-weight: bold; font-size: 16px; display: inline-block; transition: background 0.3s;">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              If the button doesn't work, you can also copy and paste this link into your browser:
            </p>
            <p style="color: #667eea; font-size: 14px; word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">
              ${verificationUrl}
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              This verification link will expire in 24 hours.
            </p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', result.messageId);
    return { success: true, messageId: result.messageId };

  } catch (error: any) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
};

// Send 6-digit code email
export const sendVerificationCodeEmail = async (email: string, name: string, code: string) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `"Cam4U" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your verification code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background:#f8f9fa;">
          <h2 style="margin:0 0 12px;color:#333;">Hi ${name},</h2>
          <p style="margin:0 0 16px;color:#555;">Use this code to verify your email address. It expires in 10 minutes.</p>
          <div style="text-align:center;">
            <div style="display:inline-block;font-size:28px;letter-spacing:6px;font-weight:700;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;color:#111;">
              ${code}
            </div>
          </div>
          <p style="margin:16px 0 0;color:#888;font-size:12px;">If you didn't request this, you can ignore this email.</p>
        </div>
      `
    };
    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};


// Send password reset email with code
export const sendPasswordResetEmail = async (email: string, name: string, code: string) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Cam4U" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset My Password - Cam4U',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #E8A75B; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
             <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #eee;">
            <h2 style="color: #333; margin-top: 0;">Hi ${name},</h2>
            <p style="color: #666; font-size: 16px;">Use the code below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
                <div style="display: inline-block; font-size: 36px; letter-spacing: 4px; font-weight: bold; background: #f4f4f4; padding: 15px 30px; border-radius: 8px;">${code}</div>
            </div>
             <p style="color: #999; font-size: 12px; text-align: center;">If you didn't request a password reset, you can safely ignore this email.</p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', result.messageId);
    return { success: true, messageId: result.messageId };

  } catch (error: any) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};

// Send welcome email after verification
export const sendWelcomeEmail = async (email: string, name: string) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Cam4U" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome - Email Verified!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Email Verified!</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">You're all set!</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Hi ${name}!</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Great news! Your email has been successfully verified. You can now access all features.
            </p>
             <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" 
                 style="background: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; 
                        font-weight: bold; font-size: 16px; display: inline-block;">
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent:', result.messageId);
    return { success: true, messageId: result.messageId };

  } catch (error: any) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};
