import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendOtp(email: string, otp: string): Promise<void> {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      this.logger.warn(
        `SMTP credentials not set. [MOCK EMAIL] To: ${email} - Your SRM Connect OTP is: ${otp}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from:
          process.env.SMTP_FROM || `"SRM Connect" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Your SRM Connect Verification Code',
        text: `Welcome to SRM Connect!\n\nYour one-time password (OTP) is: ${otp}\n\nThis code will expire in 5 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaeb; border-radius: 8px;">
            <h2 style="color: #2e86de; text-align: center;">Welcome to SRM Connect</h2>
            <p>Your verification code is:</p>
            <div style="background-color: #f4f6f8; padding: 16px; text-align: center; border-radius: 6px; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1e272e; margin: 20px 0;">
              ${otp}
            </div>
            <p style="color: #576574; font-size: 14px;">This code will expire in 5 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `,
      });
      this.logger.log(`Email OTP sent successfully to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}`, error);
      throw error;
    }
  }
}
