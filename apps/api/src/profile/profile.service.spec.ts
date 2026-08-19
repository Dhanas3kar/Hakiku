import { Test, TestingModule } from '@nestjs/testing';
import { UsernameService } from './services/username.service';
import { ProfileService } from './services/profile.service';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { BadRequestException } from '@nestjs/common';

describe('Profile Services & Storage Unit Specs', () => {
  let usernameService: UsernameService;
  let profileService: ProfileService;
  let localStorageProvider: LocalStorageProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsernameService, ProfileService, LocalStorageProvider],
    }).compile();

    usernameService = module.get<UsernameService>(UsernameService);
    profileService = module.get<ProfileService>(ProfileService);
    localStorageProvider =
      module.get<LocalStorageProvider>(LocalStorageProvider);
  });

  describe('UsernameService', () => {
    it('should normalize uppercase to lowercase', () => {
      expect(usernameService.normalize('JohnDoe')).toBe('johndoe');
    });

    it('should validate valid usernames', () => {
      expect(usernameService.validateUsername('john_doe.2024')).toBe(
        'john_doe.2024',
      );
    });

    it('should throw BadRequestException for reserved usernames', () => {
      expect(() => usernameService.validateUsername('admin')).toThrow(
        BadRequestException,
      );
      expect(() => usernameService.validateUsername('srmconnect')).toThrow(
        BadRequestException,
      );
      expect(() => usernameService.validateUsername('support')).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for leading or trailing dots/underscores', () => {
      expect(() => usernameService.validateUsername('.johndoe')).toThrow(
        BadRequestException,
      );
      expect(() => usernameService.validateUsername('johndoe_')).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for consecutive dots or underscores', () => {
      expect(() => usernameService.validateUsername('john..doe')).toThrow(
        BadRequestException,
      );
      expect(() => usernameService.validateUsername('john__doe')).toThrow(
        BadRequestException,
      );
      expect(() => usernameService.validateUsername('john._doe')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('ProfileCompletion Calculation', () => {
    it('should calculate completion percentage accurately', () => {
      const result = profileService.calculateCompletion({
        username: 'johndoe',
        displayName: 'John Doe',
        campus: 'KTR',
        department: 'CSE',
        degreeProgram: 'B.Tech',
        batchYear: 2022,
        graduationYear: 2026,
        bio: 'Hello world',
        avatarKey: 'avatar.webp',
        hasSkills: true,
        hasInterests: true,
      });

      expect(result.completionPercentage).toBe(100);
      expect(result.isProfileCompleted).toBe(true);
    });

    it('should report incomplete if required fields are missing', () => {
      const result = profileService.calculateCompletion({
        username: 'johndoe',
        displayName: 'John Doe',
      });

      expect(result.completionPercentage).toBe(0);
      expect(result.isProfileCompleted).toBe(false);
    });
  });

  describe('LocalStorageProvider File Validation', () => {
    it('should throw BadRequestException for empty buffer', () => {
      expect(() =>
        localStorageProvider.validateFile(Buffer.alloc(0), 'image/jpeg'),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for unsupported MIME type', () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      expect(() =>
        localStorageProvider.validateFile(buffer, 'application/pdf'),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid magic bytes header', () => {
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      expect(() =>
        localStorageProvider.validateFile(invalidBuffer, 'image/jpeg'),
      ).toThrow(BadRequestException);
    });

    it('should pass validation for valid JPEG header', () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      expect(() =>
        localStorageProvider.validateFile(jpegBuffer, 'image/jpeg'),
      ).not.toThrow();
    });
  });
});
