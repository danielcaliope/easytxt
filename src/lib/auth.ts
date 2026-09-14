import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const SESSION_COOKIE_NAME = "seo_geo_session";
const SESSION_TTL_DAYS = 14;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({ data: { userId, expiresAt } });
  return session;
}

export async function getSessionUser(sessionId: string | undefined) {
  if (!sessionId) return null;
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getSessionUser(sessionId);
}
