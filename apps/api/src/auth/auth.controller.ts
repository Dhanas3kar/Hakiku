import { Controller, Post, Get, Body, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

class SendOtpDto {
  email: string;
}

class VerifyOtpDto {
  email: string;
  otp: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() body: SendOtpDto, @Req() req: any) {
    await this.authService.sendOtp(body.email, req.ip);
    return { message: 'If the email is valid, an OTP will be sent.' };
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() body: VerifyOtpDto, @Req() req: any, @Res({ passthrough: true }) res: any) {
    const userAgent = req.headers['user-agent'] as string;
    const { accessToken, refreshToken, familyId } = await this.authService.verifyOtp(body.email, body.otp, req.ip || '127.0.0.1', userAgent);

    this.setCookies(res, accessToken, refreshToken, familyId);
    return { message: 'Logged in successfully' };
  }

  @Get('csrf')
  getCsrfToken(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const token = res.generateCsrf();
    return { csrfToken: token };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const refreshToken = req.cookies['refresh_token'];
    const familyId = req.cookies['family_id'];
    const userAgent = req.headers['user-agent'] as string;

    const tokens = await this.authService.refresh(refreshToken, familyId, req.ip || '127.0.0.1', userAgent);
    this.setCookies(res, tokens.accessToken, tokens.refreshToken, tokens.familyId);
    return { message: 'Token refreshed successfully' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const familyId = req.cookies['family_id'];
    await this.authService.logout(familyId, req.ip || '127.0.0.1');

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    res.clearCookie('family_id', { path: '/' });
    return { message: 'Logged out successfully' };
  }

  private setCookies(res: any, accessToken: string, refreshToken: string, familyId: string) {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
    };

    res.setCookie('access_token', accessToken, { ...cookieOptions, maxAge: 15 * 60 }); // 15 mins
    res.setCookie('refresh_token', refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 }); // 30 days
    res.setCookie('family_id', familyId, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 }); // 30 days
  }
}
