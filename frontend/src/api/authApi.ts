import axiosClient from "./axiosClient";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
}

export interface AuthResponse {
  message: string;
  user: AuthUser;
  token: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const res = await axiosClient.post<AuthResponse>("/auth/register", payload);
    return res.data;
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const res = await axiosClient.post<AuthResponse>("/auth/login", payload);
    return res.data;
  },
};
