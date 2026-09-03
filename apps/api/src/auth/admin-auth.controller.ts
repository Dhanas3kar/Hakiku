import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsString, IsNotEmpty } from 'class-validator';
import { AuthService } from './auth.service';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

class AdminLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}


  @Throttle({
    short: { limit: 5, ttl: 60000 }, // 5 req per minute
    medium: { limit: 20, ttl: 300000 }, // 20 req per 5 minutes
    long: { limit: 50, ttl: 3600000 }, // 50 req per hour
  })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: AdminLoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const userAgent = req.headers['user-agent'] as string;
    
    // We catch and throw a generic error to prevent enumeration
    try {
      const { accessToken, refreshToken, familyId } = await this.authService.adminLogin(
        body.email,
        body.password,
        req.ip || '127.0.0.1',
        userAgent,
      );

      this.setCookies(res, accessToken, refreshToken, familyId);
      return { message: 'Admin login successful' };
    } catch (error) {
      console.error('Admin login error:', error);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const familyId = req.cookies['family_id'];
    
    await this.authService.adminLogout(familyId, req.ip || '127.0.0.1');

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    res.clearCookie('family_id', { path: '/' });
    return { message: 'Admin logged out successfully' };
  }

  private setCookies(
    res: any,
    accessToken: string,
    refreshToken: string,
    familyId: string,
  ) {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };

    res.setCookie('access_token', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60,
    }); // 15 mins
    res.setCookie('refresh_token', refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60,
    }); // 30 days
    res.setCookie('family_id', familyId, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60,
    }); // 30 days
  }
}
