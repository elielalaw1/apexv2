import { randomBytes, timingSafeEqual, scryptSync } from "node:crypto";
import { cookies } from "next/headers";
import { getDb, sha, User } from "./db";
import { ApiError } from "./store";
export function login(email: string, password: string) {
  const db = getDb();
  const user = db
    .prepare("SELECT * FROM users WHERE email=?")
    .get(email.toLowerCase()) as User | undefined;
  const [salt, hash] = (
    user?.password ?? "dummy:" + Buffer.alloc(64).toString("hex")
  ).split(":");
  const actual = scryptSync(password, salt, 64);
  if (!timingSafeEqual(actual, Buffer.from(hash, "hex")) || !user)
    throw new ApiError(401, "Incorrect email or password");
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO auth VALUES(?,?,?)").run(
    sha(token),
    user.id,
    Date.now() + 7 * 86400000,
  );
  return { token, user };
}
export async function currentUser(request?: Request): Promise<User> {
  const bearer = request?.headers
    .get("authorization")
    ?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const token = bearer || (await cookies()).get("apex_session")?.value;
  if (!token) throw new ApiError(401, "Sign in to continue");
  const row = getDb()
    .prepare(
      "SELECT u.* FROM users u JOIN auth a ON a.user_id=u.id WHERE a.token=? AND a.expires>?",
    )
    .get(sha(token), Date.now()) as User | undefined;
  if (!row) throw new ApiError(401, "Your sign-in has expired");
  return row;
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  const expected =
    process.env.APEX_PUBLIC_ORIGIN ??
    `${url.protocol}//${req.headers.get("host") ?? url.host}`;
  if (origin && origin !== expected)
    throw new ApiError(403, "Request must originate from the same origin");
}
