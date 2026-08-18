import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendOtp(email: string, otp: string): Promise<void> {
    // Mock email sending
    this.logger.log(`[MOCK EMAIL] To: ${email} - Your SRM Connect OTP is: ${otp}`);
    // In production, integrate with AWS SES, SendGrid, etc.
  }
}
