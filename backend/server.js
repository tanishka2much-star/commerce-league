"use strict";

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit").rateLimit;
const { Pool } = require("pg");
const {
  createHash,
  randomBytes,
  randomUUID,
  scrypt: scryptCallback,
  timingSafeEqual
} = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(scryptCallback);
const app = express();
const port = Number(process.env.PORT || 3000);
const appOrigin = process.env.APP_ORIGIN;
const sessionDays = Number(process.env.SESSION_DAYS || 30);
const trustProxy = process.env.TRUST_PROXY === "true";

if (!process.env.DATABASE_URL || !appOrigin) {
  throw new Error("DATABASE_URL and APP_ORIGIN must be configured.");
}
if (!Number.isInteger(sessionDays) || sessionDays < 1 || sessionDays > 90) {
  throw new Error("SESSION_DAYS must be between 1 and 90.");
}

app.disable("x-powered-by");
if (trustProxy) app.set("trust proxy", 1);
app.use(helmet());
app.use((req, res, next) => {
  const origin = req.get("origin");
  res.vary("Origin");
  if (origin && origin !== appOrigin) {
    return res.status(403).json({ error: "Origin not allowed." });
  }
  if (origin === appOrigin) {
    res.set("Access-Control-Allow-Origin", appOrigin);
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "16kb" }));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const createAccountLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false
});
const signInLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false
});
const recoveryLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function canonicalClId(value) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = compact.match(/^CL([A-F0-9]{20})$/);
  return match ? "CL-" + match[1].slice(0, 10) + "-" + match[1].slice(10) : null;
}

function makeClId() {
  const raw = randomBytes(10).toString("hex").toUpperCase();
  return "CL-" + raw.slice(0, 10) + "-" + raw.slice(10);
}

function makeRecoveryCode() {
  const raw = randomBytes(16).toString("hex").toUpperCase();
  return raw.match(/.{1,4}/g).join("-");
}

function canonicalRecoveryCode(value) {
  const compact = String(value || "").toUpperCase().replace(/[^A-F0-9]/g, "");
  return /^[A-F0-9]{32}$/.test(compact) ? compact : null;
}

function secretHash(value) {
  return createHash("sha256").update(value, "utf8").digest();
}

async function deriveSecret(value, salt) {
  return scrypt(value, salt, 64, {
    N: 1 << 15,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });
}

function matchesSecret(actual, expected) {
  return Buffer.isBuffer(actual) &&
    Buffer.isBuffer(expected) &&
    actual.length === expected.length &&
    timingSafeEqual(actual, expected);
}

async function issueSession(client, studentId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);
  await client.query(
    "INSERT INTO student_sessions (token_hash, student_id, expires_at) VALUES ($1, $2, $3)",
    [secretHash(token), studentId, expiresAt]
  );
  return token;
}

async function requireStudent(req, res, next) {
  try {
    const match = String(req.get("authorization") || "").match(/^Bearer ([a-f0-9]{64})$/i);
    if (!match) return res.status(401).json({ error: "Please sign in to continue." });
    const result = await pool.query(
      "SELECT student_id FROM student_sessions WHERE token_hash = $1 AND expires_at > NOW()",
      [secretHash(match[1])]
    );
    if (!result.rowCount) return res.status(401).json({ error: "Session expired. Please sign in again." });
    req.studentId = result.rows[0].student_id;
    next();
  } catch (error) {
    next(error);
  }
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/accounts", createAccountLimit, asyncRoute(async (req, res) => {
  const studentName = typeof req.body.studentName === "string" ? req.body.studentName.trim() : "";
  const grade = typeof req.body.grade === "string" ? req.body.grade.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (studentName.length < 2 || studentName.length > 80 || !grade || grade.length > 40) {
    return res.status(400).json({ error: "Enter a name and class or grade." });
  }
  if (password.length < 10 || password.length > 128) {
    return res.status(400).json({ error: "Choose a password between 10 and 128 characters." });
  }

  const studentId = randomUUID();
  const clId = makeClId();
  const recoveryCode = makeRecoveryCode();
  const passwordSalt = randomBytes(16);
  const recoverySalt = randomBytes(16);
  const passwordHash = await deriveSecret(password, passwordSalt);
  const recoveryHash = await deriveSecret(canonicalRecoveryCode(recoveryCode), recoverySalt);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO students (id, cl_id, student_name, grade, password_salt, password_hash, recovery_salt, recovery_hash) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [studentId, clId, studentName, grade, passwordSalt, passwordHash, recoverySalt, recoveryHash]
    );
    const token = await issueSession(client, studentId);
    await client.query("COMMIT");
    res.status(201).json({
      clId,
      token,
      recoveryCode,
      student: { studentName, grade }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.post("/api/sessions", signInLimit, asyncRoute(async (req, res) => {
  const clId = canonicalClId(req.body.clId);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!clId || password.length > 128) {
    return res.status(401).json({ error: "CL ID or password is incorrect." });
  }
  const result = await pool.query(
    "SELECT id, student_name, grade, password_salt, password_hash FROM students WHERE cl_id = $1",
    [clId]
  );
  if (!result.rowCount) return res.status(401).json({ error: "CL ID or password is incorrect." });
  const student = result.rows[0];
  const candidate = await deriveSecret(password, student.password_salt);
  if (!matchesSecret(candidate, student.password_hash)) {
    return res.status(401).json({ error: "CL ID or password is incorrect." });
  }

  const client = await pool.connect();
  try {
    const token = await issueSession(client, student.id);
    res.json({
      token,
      student: { studentName: student.student_name, grade: student.grade }
    });
  } finally {
    client.release();
  }
}));

app.delete("/api/sessions/current", requireStudent, asyncRoute(async (req, res) => {
  const match = String(req.get("authorization") || "").match(/^Bearer ([a-f0-9]{64})$/i);
  await pool.query(
    "DELETE FROM student_sessions WHERE token_hash = $1",
    [secretHash(match[1])]
  );
  res.sendStatus(204);
}));

app.get("/api/me", requireStudent, asyncRoute(async (req, res) => {
  const result = await pool.query(
    "SELECT cl_id, student_name, grade, created_at FROM students WHERE id = $1",
    [req.studentId]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Student account not found." });
  const student = result.rows[0];
  res.json({
    student: {
      clId: student.cl_id,
      studentName: student.student_name,
      grade: student.grade,
      createdAt: student.created_at
    }
  });
}));

app.get("/api/progress", requireStudent, asyncRoute(async (req, res) => {
  const result = await pool.query(
    "SELECT id, quiz_code, score, total_questions, completed_at, is_official FROM practice_attempts WHERE student_id = $1 ORDER BY completed_at DESC",
    [req.studentId]
  );
  res.json({ attempts: result.rows });
}));

app.post("/api/attempts", requireStudent, asyncRoute(async (req, res) => {
  const quizCode = typeof req.body.quizCode === "string" ? req.body.quizCode.trim() : "";
  const score = Number(req.body.score);
  const totalQuestions = Number(req.body.totalQuestions);
  if (
    !/^[a-z0-9-]{1,50}$/i.test(quizCode) ||
    !Number.isInteger(score) ||
    !Number.isInteger(totalQuestions) ||
    totalQuestions < 1 ||
    totalQuestions > 100 ||
    score < 0 ||
    score > totalQuestions
  ) {
    return res.status(400).json({ error: "Invalid practice result." });
  }

  const id = randomUUID();
  await pool.query(
    "INSERT INTO practice_attempts (id, student_id, quiz_code, score, total_questions, is_official) VALUES ($1, $2, $3, $4, $5, FALSE)",
    [id, req.studentId, quizCode, score, totalQuestions]
  );
  res.status(201).json({ id, quizCode, score, totalQuestions, isOfficial: false });
}));

app.post("/api/recovery/reset", recoveryLimit, asyncRoute(async (req, res) => {
  const clId = canonicalClId(req.body.clId);
  const recoveryCode = canonicalRecoveryCode(req.body.recoveryCode);
  const newPassword = typeof req.body.newPassword === "string" ? req.body.newPassword : "";
  if (!clId || !recoveryCode || newPassword.length < 10 || newPassword.length > 128) {
    return res.status(400).json({ error: "Check your CL ID, recovery code, and new password." });
  }

  const client = await pool.connect();
  let replacementCode;
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT id, recovery_salt, recovery_hash FROM students WHERE cl_id = $1 FOR UPDATE",
      [clId]
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "CL ID or recovery code is incorrect." });
    }
    const student = result.rows[0];
    const candidate = await deriveSecret(recoveryCode, student.recovery_salt);
    if (!matchesSecret(candidate, student.recovery_hash)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "CL ID or recovery code is incorrect." });
    }

    replacementCode = makeRecoveryCode();
    const passwordSalt = randomBytes(16);
    const recoverySalt = randomBytes(16);
    const passwordHash = await deriveSecret(newPassword, passwordSalt);
    const recoveryHash = await deriveSecret(canonicalRecoveryCode(replacementCode), recoverySalt);
    await client.query(
      "UPDATE students SET password_salt = $1, password_hash = $2, recovery_salt = $3, recovery_hash = $4 WHERE id = $5",
      [passwordSalt, passwordHash, recoverySalt, recoveryHash, student.id]
    );
    await client.query("DELETE FROM student_sessions WHERE student_id = $1", [student.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  res.json({
    message: "Password updated. Save your new recovery code now.",
    recoveryCode: replacementCode
  });
}));

app.use((_req, res) => res.status(404).json({ error: "Endpoint not found." }));
app.use((error, _req, res, _next) => {
  console.error("API request failed:", error.message);
  res.status(500).json({ error: "The request could not be completed." });
});

const server = app.listen(port, () => {
  console.log("Commerce League API listening on port " + port);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
