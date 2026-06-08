import type {
  AuthResponse,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  MessageResponse,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  User,
} from '@org/dto';
import type { HttpClient } from './http';

export const createAuthService = (http: HttpClient) => ({
  login: (payload: LoginDto) =>
    http.post<AuthResponse>('/auth/login', payload).then((r) => r.data),
  register: (payload: RegisterDto) =>
    http.post<AuthResponse>('/auth/register', payload).then((r) => r.data),
  refresh: (payload: RefreshDto) =>
    http.post<AuthResponse>('/auth/refresh', payload).then((r) => r.data),
  logout: () => http.post<MessageResponse>('/auth/logout').then((r) => r.data),
  me: () => http.get<User>('/auth/me').then((r) => r.data),
  forgotPassword: (payload: ForgotPasswordDto) =>
    http
      .post<MessageResponse>('/auth/forgot-password', payload)
      .then((r) => r.data),
  resetPassword: (payload: ResetPasswordDto) =>
    http
      .post<MessageResponse>('/auth/reset-password', payload)
      .then((r) => r.data),
  changePassword: (payload: ChangePasswordDto) =>
    http
      .post<MessageResponse>('/auth/change-password', payload)
      .then((r) => r.data),
});

export type AuthService = ReturnType<typeof createAuthService>;
