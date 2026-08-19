import {
  Injectable,
  Inject,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import Redis from 'ioredis';
import { createHmac, randomInt } from 'crypto';

@Injectable()
export class OtpService {
  private readonly OTP_TTL = 300; // 5 minutes
  private readonly MAX_ATTEMPTS = 5;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  private hashOtp(otp: string): string {
    const secret = process.env.OTP_SECRET || 'dev-secret';
    return createHmac('sha256', secret).update(otp).digest('hex');
  }

  async generateOtp(email: string): Promise<string> {
    const cooldownKey = `auth:cooldown:${email}`;
    const exists = await this.redis.get(cooldownKey);
    if (exists) {
      throw new HttpException(
        'Please wait 60 seconds before requesting another OTP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const rateLimitKey = `auth:rate_limit:otp_requests:${email}`;
    const requests = await this.redis.incr(rateLimitKey);
    if (requests === 1) {
      await this.redis.expire(rateLimitKey, 600); // 10 minutes
    }
    if (requests > 3) {
      throw new HttpException(
        'Too many OTP requests. Please try again in 10 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = randomInt(100000, 999999).toString();
    const hashedOtp = this.hashOtp(otp);

    const otpKey = `auth:otp:${email}`;
    await this.redis.set(otpKey, hashedOtp, 'EX', this.OTP_TTL);

    // Set 60s cooldown
    await this.redis.set(cooldownKey, '1', 'EX', 60);

    return otp;
  }

  async verifyOtp(email: string, otp: string): Promise<boolean> {
    const attemptsKey = `auth:otp_attempts:${email}`;
    const attempts = await this.redis.incr(attemptsKey);
    if (attempts === 1) {
      await this.redis.expire(attemptsKey, this.OTP_TTL);
    }

    if (attempts > this.MAX_ATTEMPTS) {
      await this.redis.del(`auth:otp:${email}`);
      throw new UnauthorizedException('Too many failed attempts. OTP revoked.');
    }

    const otpKey = `auth:otp:${email}`;
    const hashedOtp = await this.redis.get(otpKey);

    if (!hashedOtp) {
      throw new UnauthorizedException('OTP expired or invalid');
    }

    if (this.hashOtp(otp) !== hashedOtp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // Success: one-time use
    await this.redis.del(otpKey);
    await this.redis.del(attemptsKey);

    return true;
  }
}
