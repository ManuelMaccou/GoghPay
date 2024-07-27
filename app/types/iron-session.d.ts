import 'iron-session';

declare module 'iron-session' {
  interface IronSessionData {
    csrfToken?: string;
    accessToken?: string;
    refreshToken?: string;
  }
}