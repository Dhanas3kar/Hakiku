import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

export async function verifyWsClient(client: Socket, jwtService: JwtService): Promise<string | null> {
  const authHeader = client.handshake.auth.token || client.handshake.headers.authorization;
  if (!authHeader) return null;

  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer' || !token) return null;

  try {
    const payload = await jwtService.verifyAsync(token, {
      secret: process.env.JWT_SECRET || 'super-secret',
    });
    return payload.sub; // userId
  } catch (err) {
    return null;
  }
}
