import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email/email.service';
import { OtpService } from './otp/otp.service';
import { SessionService } from './session/session.service';
import { JwtModule } from '@nestjs/jwt';

import { AdminAuthController } from './admin-auth.controller';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET!,
      signOptions: {
        expiresIn: '15m',
        issuer: process.env.JWT_ISSUER || 'hakiku.com',
        audience: process.env.JWT_AUDIENCE || 'hakiku.com',
      },
      verifyOptions: {
        issuer: process.env.JWT_ISSUER || 'hakiku.com',
        audience: process.env.JWT_AUDIENCE || 'hakiku.com',
        ignoreExpiration: false,
      },
    }),
  ],
  controllers: [AuthController, AdminAuthController],
  providers: [AuthService, EmailService, OtpService, SessionService],
  exports: [AuthService],
})
export class AuthModule {}
