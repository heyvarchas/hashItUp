export interface AuthClaims {
  sub: string;
  person_id: string;
  pseudonymous_id: string;
  role: 'personnel' | 'welfare_officer' | 'admin';
  exp: number;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: string;
  expires_in_hours: number;
}

export interface UserSession {
  token: string;
  claims: AuthClaims;
}
