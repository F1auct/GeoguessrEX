import crypto from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersPath = path.resolve(__dirname, "../data/users.json");
const tokenSecret = process.env.AUTH_SECRET || "geoguesr-dev-auth-secret";
const passwordIterations = 120000;
const passwordKeyLength = 64;
const tokenTtlMs = 1000 * 60 * 60 * 24 * 7;

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt
  };
}

async function readUsers() {
  try {
    const data = await readFile(usersPath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    if (err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function writeUsers(users) {
  await mkdir(path.dirname(usersPath), { recursive: true });
  await writeFile(usersPath, `${JSON.stringify(users, null, 2)}\n`, "utf8");
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

export async function registerUser({ username, email, password }) {
  const validationError = validateRegistration({ username, email, password });
  if (validationError) {
    return { status: 400, error: validationError };
  }

  const users = await readUsers();
  const usernameKey = normalize(username);
  const emailKey = normalize(email);

  if (users.some((user) => user.usernameKey === usernameKey)) {
    return { status: 409, error: "Username is already registered." };
  }
  if (users.some((user) => user.emailKey === emailKey)) {
    return { status: 409, error: "Email is already registered." };
  }

  const user = {
    id: crypto.randomUUID(),
    username: String(username).trim(),
    usernameKey,
    email: String(email).trim(),
    emailKey,
    password: hashPassword(String(password)),
    createdAt: new Date().toISOString()
  };

  users.push(user);
  await writeUsers(users);

  return {
    user: publicUser(user),
    token: createToken(user)
  };
}

export async function loginUser({ identifier, password }) {
  if (!identifier || !password) {
    return { status: 400, error: "Username or email and password are required." };
  }

  const identifierKey = normalize(identifier);
  const users = await readUsers();
  const user = users.find(
    (item) => item.usernameKey === identifierKey || item.emailKey === identifierKey
  );

  if (!user || !verifyPassword(String(password), user.password)) {
    return { status: 401, error: "Invalid username/email or password." };
  }

  return {
    user: publicUser(user),
    token: createToken(user)
  };
}

export async function getUserFromToken(token) {
  const payload = readToken(token);
  if (!payload) {
    return null;
  }

  const users = await readUsers();
  const user = users.find((item) => item.id === payload.sub);
  return user ? publicUser(user) : null;
}
