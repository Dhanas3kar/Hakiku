import { client } from './client'

export const authApi = {
  sendOtp: (email: string) => client.post('/auth/send-otp', { email }),
  verifyOtp: (email: string, otp: string) => client.post('/auth/verify-otp', { email, otp }),
  logout: () => client.post('/auth/logout'),
}
