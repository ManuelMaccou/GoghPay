import { getIronSession, SessionOptions, IronSession } from 'iron-session';
import { NextRequest } from 'next/server';

const sessionOptions: SessionOptions = {
  password: process.env.SECRET_COOKIE_PASSWORD as string,
  cookieName: 'auth_session',
  cookieOptions: {
    secure: process.env.SECURE_ENV === 'true',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  },
};

interface CustomSessionData {
  csrfToken?: string;
  accessToken?: string;
  refreshToken?: string;
}

export async function getSession(request: NextRequest): Promise<IronSession<CustomSessionData>> {
  return getIronSession<CustomSessionData>(request.cookies, sessionOptions);
}
