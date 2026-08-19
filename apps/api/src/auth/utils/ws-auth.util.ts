import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

export async function verifyWsClient(
  client: Socket,
  jwtService: JwtService,
): Promise<string | null> {
  let token = null;

  // Try to get token from cookies
  const cookieHeader = client.handshake.headers.cookie;
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((c) => c.trim().split('=')),
    );
    token = cookies['access_token'];
  }

  // Fallback to auth payload or authorization header (useful for testing)
  if (!token) {
    const authHeader =
      client.handshake.auth.token || client.handshake.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }
  }

  if (!token) return null;

  try {
    const payload = await jwtService.verifyAsync(token, {
      secret: process.env.JWT_SECRET || 'super-secret',
    });
    return payload.sub; // userId
  } catch (err) {
    return null;
  }
}
