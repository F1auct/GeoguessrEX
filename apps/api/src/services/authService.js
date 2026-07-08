import crypto from "crypto";
import { db } from "./database.js";

const tokenSecret = process.env.AUTH_SECRET || "geoguesr-dev-auth-secret";
const adminRegisterCode = process.env.ADMIN_REGISTER_CODE || "";
const passwordIterations = 120000;
const passwordKeyLength = 64;
const tokenTtlMs = 1000 * 60 * 60 * 24 * 7;

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    createdAt: row.created_at
  };
}

function passwordFromRow(row) {
  return {
    hash: row.password_hash,
    salt: row.password_salt,
    iterations: row.password_iterations,
    keyLength: row.password_key_length,
    digest: row.password_digest
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto
    .pbkdf2Sync(password, salt, passwordIterations, passwordKeyLength, "sha512")
    .toString("hex");

  return {
    hash,
    salt,
    iterations: passwordIterations,
    keyLength: passwordKeyLength,
    digest: "sha512"
  };
}

function verifyPassword(password, passwordHash) {
  const candidate = crypto
    .pbkdf2Sync(
      password,
      passwordHash.salt,
      passwordHash.iterations,
      passwordHash.keyLength,
      passwordHash.digest
    )
    .toString("hex");

  const candidateBuffer = Buffer.from(candidate, "hex");
  const hashBuffer = Buffer.from(passwordHash.hash, "hex");

  return (
    candidateBuffer.length === hashBuffer.length &&
    crypto.timingSafeEqual(candidateBuffer, hashBuffer)
  );
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(value) {
  return crypto.createHmac("sha256", tokenSecret).update(value).digest("base64url");
}

function createToken(user) {
  const payload = {
    sub: user.id,
    exp: Date.now() + tokenTtlMs
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function readToken(token) {
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature || sign(encodedPayload) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (!payload.sub || !payload.exp || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function validateRegistration({ username, email, password }) {
  if (!username || normalize(username).length < 3) {
    return "Username must be at least 3 characters.";
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return "A valid email address is required.";
  }
  if (!password || String(password).length < 8) {
    return "Password must be at least 8 characters.";
  }
  return "";
}

export function registerUser({ username, email, password, adminCode }) {
  const validationError = validateRegistration({ username, email, password });
  if (validationError) {
    return { status: 400, error: validationError };
  }

  const usernameKey = normalize(username);
  const emailKey = normalize(email);

  const existing = db
    .prepare("SELECT id, username_key, email_key FROM users WHERE username_key = ? OR email_key = ?")
    .get(usernameKey, emailKey);

  if (existing?.username_key === usernameKey) {
    return { status: 409, error: "Username is already registered." };
  }
  if (existing?.email_key === emailKey) {
    return { status: 409, error: "Email is already registered." };
  }

  const wantsAdmin = String(adminCode || "").trim().length > 0;
  if (wantsAdmin && (!adminRegisterCode || String(adminCode).trim() !== adminRegisterCode)) {
    return { status: 403, error: "Invalid admin registration code." };
  }

  const passwordHash = hashPassword(String(password));
  const user = {
    id: crypto.randomUUID(),
    username: String(username).trim(),
    usernameKey,
    email: String(email).trim(),
    emailKey,
    role: wantsAdmin ? "admin" : "user",
    createdAt: new Date().toISOString()
  };

  db.prepare(`
    INSERT INTO users (
      id, username, username_key, email, email_key, role,
      password_hash, password_salt, password_iterations, password_key_length, password_digest, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    user.username,
    user.usernameKey,
    user.email,
    user.emailKey,
    user.role,
    passwordHash.hash,
    passwordHash.salt,
    passwordHash.iterations,
    passwordHash.keyLength,
    passwordHash.digest,
    user.createdAt
  );

  return {
    user: publicUser({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      created_at: user.createdAt
    }),
    token: createToken(user)
  };
}

export function loginUser({ identifier, password }) {
  if (!identifier || !password) {
    return { status: 400, error: "Username or email and password are required." };
  }

  const identifierKey = normalize(identifier);
  const row = db
    .prepare("SELECT * FROM users WHERE username_key = ? OR email_key = ?")
    .get(identifierKey, identifierKey);

  if (!row || !verifyPassword(String(password), passwordFromRow(row))) {
    return { status: 401, error: "Invalid username/email or password." };
  }

  const user = publicUser(row);
  return {
    user,
    token: createToken(user)
  };
}

export function getUserFromToken(token) {
  const payload = readToken(token);
  if (!payload) {
    return null;
  }

  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub);
  return row ? publicUser(row) : null;
}
