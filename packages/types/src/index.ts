export interface User {
  id: string;
  email: string;
  isVerified: boolean;
  role: 'STUDENT' | 'MODERATOR' | 'ADMIN';
  createdAt: Date;
}
