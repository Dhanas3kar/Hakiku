import { Injectable, BadRequestException } from '@nestjs/common';

const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'srmconnect',
  'srm',
  'official',
  'support',
  'help',
  'api',
  'system',
  'mod',
  'moderator',
  'root',
  'null',
  'undefined',
  'auth',
  'networking',
  'profile',
  'settings',
  'dashboard',
]);

@Injectable()
export class UsernameService {
  normalize(username: string): string {
    return username ? username.trim().toLowerCase() : '';
  }

  validateUsername(username: string): string {
    const normalized = this.normalize(username);

    if (!normalized || normalized.length < 3 || normalized.length > 30) {
      throw new BadRequestException(
        'Username must be between 3 and 30 characters in length',
      );
    }

    if (RESERVED_USERNAMES.has(normalized)) {
      throw new BadRequestException(
        `Username '${normalized}' is reserved and cannot be used`,
      );
    }

    // Must start and end with alphanumeric character
    const formatRegex = /^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/;
    if (!formatRegex.test(normalized)) {
      throw new BadRequestException(
        'Username can only contain alphanumeric characters, dots, and underscores, and cannot start or end with a dot or underscore',
      );
    }

    // Reject consecutive dots or underscores
    if (/\.\.|\_\_|\.\_|\_\./.test(normalized)) {
      throw new BadRequestException(
        'Username cannot contain consecutive dots or underscores',
      );
    }

    return normalized;
  }
}
