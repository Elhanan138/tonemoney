import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { ChatMessage, ChatStats } from "../chat/types";
import type { SetupAnswers } from "../setup";
import type { Report } from "../report/schema";

/**
 * File-backed store for local dev. Swap for Supabase (Postgres + Storage) in production:
 * the interface is the only thing the routes use.
 */
export interface ChatRecord {
  id: string;
  createdAt: number;
  email: string;
  answers: SetupAnswers;
  stats: ChatStats;
  /** deleted by the cleanup job; the report survives */
  messages: ChatMessage[] | null;
  report: Report | null;
  reportStatus: "none" | "writing" | "done" | "error";
  reportError?: string;
  reportAt: number | null;
  cutoff: number | null;
  readMessages: number;
  paid: boolean;
  paidAt: number | null;
  shareToken: string | null;
  stripeSessionId?: string;
}

const DIR = process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
const chatsDir = path.join(DIR, "chats");
const idRe = /^[A-Za-z0-9_-]{16,64}$/;

export const newId = (bytes = 16) => crypto.randomBytes(bytes).toString("base64url");

async function ensure() {
  await fs.mkdir(chatsDir, { recursive: true });
}

export async function saveChat(rec: ChatRecord): Promise<void> {
  await ensure();
  const file = path.join(chatsDir, `${rec.id}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(rec));
  await fs.rename(tmp, file);
}

export async function getChat(id: string): Promise<ChatRecord | null> {
  if (!idRe.test(id)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(chatsDir, `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}

export async function findByShareToken(token: string): Promise<ChatRecord | null> {
  if (!idRe.test(token)) return null;
  for (const rec of await listChats()) if (rec.shareToken === token) return rec;
  return null;
}

export async function listChats(): Promise<ChatRecord[]> {
  await ensure();
  const files = (await fs.readdir(chatsDir)).filter((f) => f.endsWith(".json"));
  const out: ChatRecord[] = [];
  for (const f of files) {
    try {
      out.push(JSON.parse(await fs.readFile(path.join(chatsDir, f), "utf8")));
    } catch {}
  }
  return out;
}

export async function deleteChat(id: string): Promise<void> {
  if (!idRe.test(id)) return;
  await fs.rm(path.join(chatsDir, `${id}.json`), { force: true });
}

// ---- OTP (email + 6 digits, no password) ----
const otpFile = path.join(DIR, "otp.json");
type OtpRow = { hash: string; exp: number; tries: number };
const hash = (email: string, code: string) => crypto.createHash("sha256").update(`${email.toLowerCase()}:${code}`).digest("hex");

async function readOtp(): Promise<Record<string, OtpRow>> {
  try {
    return JSON.parse(await fs.readFile(otpFile, "utf8"));
  } catch {
    return {};
  }
}

export async function issueOtp(email: string): Promise<string> {
  await fs.mkdir(DIR, { recursive: true });
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const all = await readOtp();
  all[email.toLowerCase()] = { hash: hash(email, code), exp: Date.now() + 10 * 60_000, tries: 0 };
  await fs.writeFile(otpFile, JSON.stringify(all));
  return code;
}

export async function checkOtp(email: string, code: string): Promise<boolean> {
  const all = await readOtp();
  const row = all[email.toLowerCase()];
  if (!row || row.exp < Date.now() || row.tries >= 5) return false;
  const ok = row.hash === hash(email, code);
  if (ok) delete all[email.toLowerCase()];
  else row.tries++;
  await fs.writeFile(otpFile, JSON.stringify(all));
  return ok;
}
