import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { registerHooks } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import mariadb from "mariadb";
import bcrypt from "bcryptjs";
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet, decodeJwt } from "jose";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client.ts";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: new URL("../node_modules/next/dist/compiled/server-only/empty.js", import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const [mode, directory, container, ...extra] = process.argv.slice(2);
assert(["prepare", "baseline", "services", "http"].includes(mode));
assert(path.isAbsolute(directory) && !path.resolve(directory).startsWith(process.cwd() + path.sep));
const url = new URL(process.env.DATABASE_URL);
assert(["127.0.0.1", "localhost"].includes(url.hostname));
const database = url.pathname.slice(1); assert(/^e07_rehearsal_[a-z0-9_]{1,24}$/.test(database));
const stateFile = path.join(directory, `${database}.json`), contractFile = path.join(directory, `${database}-contracts.json`);
const secret = randomBytes(32).toString("hex"); process.env.SESSION_SECRET = secret;
for (const key of ["SMTP_HOST", "SMTP_PASS", "SMTP_USER", "STORE_EMAIL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) process.env[key] = "";
const raw = new PrismaClient({ adapter: new PrismaMariaDb(url.href) });
let applicationClient, server, checks = 0, serverLog = "";
const check = async (label, callback) => { await callback(); checks++; console.log(`OK ${label}`); };
const hash = (value) => createHash("sha256").update(value).digest("hex");
const dockerArgs = ["exec", "-i", "-e", `MYSQL_PWD=${decodeURIComponent(url.password)}`, container];
const sql = (name, input) => {
  assert(/^e07_rehearsal_[a-z0-9_]+$/.test(name));
  return spawnSync("docker", [...dockerArgs, "mariadb", `-u${decodeURIComponent(url.username)}`, name], { input, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
};
const dump = (name) => {
  assert(/^e0[67]_rehearsal_[a-z0-9_]+$/.test(name));
  const result = spawnSync("docker", [...dockerArgs, "mariadb-dump", `-u${decodeURIComponent(url.username)}`, "--single-transaction", "--routines", "--triggers", "--skip-comments", name], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr); return result.stdout;
};
async function copy(name, backup) {
  assert(/^e07_rehearsal_[a-z0-9_]+$/.test(name));
  const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) });
  try { await connection.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); } finally { await connection.end(); }
  const restored = sql(name, backup); assert.equal(restored.status, 0, restored.stderr);
}
const shape = (value) => value === null ? "null" : Array.isArray(value) ? { array: [...new Set(value.map((item) => JSON.stringify(shape(item))))].sort() } : typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, shape(value[key])])) : typeof value;
function request(port, host, target, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: target, method: options.method ?? "GET", headers: { host, "content-type": "application/json", ...options.headers }, timeout: 40_000 }, (res) => {
      const chunks = []; res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject); req.on("timeout", () => req.destroy(new Error("HTTP timeout"))); req.end(options.body === undefined ? undefined : JSON.stringify(options.body));
  });
}
async function api(port, host, target, expected, options) {
  const result = await request(port, host, target, options);
  assert.equal(result.status, expected, `${host}${target}: ${result.status} ${result.text}`);
  assert.match(result.headers["cache-control"], /private.*no-store/);
  return { ...result, body: JSON.parse(result.text) };
}
const sessionCookie = (result) => (result.headers["set-cookie"] ?? []).map((value) => value.split(";")[0]).find((value) => value.startsWith("vlp_session="));
const signSession = (id, claims = {}) => new SignJWT({ role: "ADMIN", ...claims }).setProtectedHeader({ alg: "HS256" }).setSubject(id).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(secret));

try {
  const { resolveStoreContext, runWithStoreContext } = await import("../src/lib/server/store-context.ts");
  if (mode === "prepare") {
    const [source, first, second] = extra; assert(/^e06_rehearsal_[a-z0-9_]+$/.test(source));
    await fs.mkdir(directory, { recursive: true });
    const backup = dump(source); await fs.writeFile(path.join(directory, `${database}-source.sql`), backup, { flag: "wx" });
    await copy(database, backup);
    const oldIdentity = sql(database, "SELECT id,passwordHash,googleId FROM users ORDER BY id;").stdout;
    const original = sql(database, "SELECT id FROM users ORDER BY id LIMIT 1;").stdout.trim().split(/\r?\n/).at(-1);
    assert(/^[a-zA-Z0-9_-]+$/.test(original));
    assert.equal(sql(database, `INSERT INTO password_reset_tokens (id,userId,tokenHash,expiresAt) VALUES ('e07-legacy-reset','${original}','${hash("E07 legacy token")}',DATE_ADD(NOW(3), INTERVAL 1 HOUR));`).status, 0);
    const before = dump(database); await fs.writeFile(path.join(directory, `${database}-before-migration.sql`), before, { flag: "wx" });
    const migration = await fs.readFile("prisma/migrations/20261113010000_store_identity/migration.sql", "utf8");
    await check("migración preserva hashes/Google IDs y liga tokens históricos a original sin promover roles", async () => {
      const applied = sql(database, migration); assert.equal(applied.status, 0, applied.stderr);
      assert.equal(sql(database, "SELECT id,passwordHash,googleId FROM users ORDER BY id;").stdout, oldIdentity);
      const token = await raw.passwordResetToken.findUniqueOrThrow({ where: { id: "e07-legacy-reset" } });
      assert.equal(token.storeId, "store-original"); assert.equal(token.sessionVersion, 0);
    });
    await check("respaldo restaurado en nueva copia recupera esquema y credenciales anteriores", async () => {
      await copy(database + "_rollback", before);
      assert.equal(sql(database + "_rollback", "SHOW COLUMNS FROM users LIKE 'sessionVersion';").stdout.trim(), "");
      assert.equal(sql(database + "_rollback", "SELECT id,passwordHash,googleId FROM users ORDER BY id;").stdout, oldIdentity);
    });
    const contexts = await Promise.all([first, second].map((host) => resolveStoreContext(raw, new Headers({ host }), { environment: "production" })));
    const stores = contexts.map((context) => context.id);
    const a = await raw.user.findUniqueOrThrow({ where: { email: "admin@variedadeslosprimos.com" } });
    const passwordHash = await bcrypt.hash("admin123", 10);
    const b = await raw.user.update({ where: { id: "e02-user" }, data: { email: "e07-owner@variedadeslosprimos.com", passwordHash } });
    const users = { a: a.id, b: b.id };
    for (const [name, data] of Object.entries({ exclusive: {}, global: { role: "ADMIN" }, suspended: {}, inactive: { status: "INACTIVE" }, shared: {} })) {
      users[name] = (await raw.user.create({ data: { name: `E07 ${name}`, email: `e07-${name}@variedadeslosprimos.com`, passwordHash, ...data } })).id;
    }
    const member = (storeId, userId, role, active = true) => raw.storeMembership.upsert({ where: { storeId_userId: { storeId, userId } }, update: { role, active }, create: { storeId, userId, role, active } });
    await member(stores[0], a.id, "ADMIN"); await member(stores[1], a.id, "CUSTOMER");
    await member(stores[0], b.id, "CUSTOMER"); await member(stores[1], b.id, "OWNER");
    await member(stores[1], users.exclusive, "CUSTOMER"); await member(stores[0], users.suspended, "ADMIN", false);
    await member(stores[0], users.inactive, "ADMIN"); await member(stores[0], users.shared, "CUSTOMER"); await member(stores[1], users.shared, "CUSTOMER");
    await fs.writeFile(stateFile, JSON.stringify({ stores, hosts: [first, second], users, backupSha256: hash(before) }, null, 2), { flag: "wx" });
    console.log(`ROLLBACK: respaldo externo ${database}-before-migration.sql SHA256 ${hash(before)}, restaurado en ${database}_rollback. No se desplegó en bases preexistentes. Ante rollback real: detener escrituras y confirmar restauración; no eliminar versiones/estados nuevos sin revisión.`);
  } else {
    const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
    const contexts = await Promise.all(state.hosts.map((host) => resolveStoreContext(raw, new Headers({ host }), { environment: "production" })));
    if (mode === "services") {
      const google = await import("../src/lib/server/google.ts");
      const auth = await import("../src/lib/server/auth.ts");
      applicationClient = (await import("../src/lib/prisma.ts")).prisma;
      const run = (index, callback) => runWithStoreContext(contexts[index], callback);
      await check("JWT global/tenant/rol no sustituyen membresía activa ni usuario vigente", async () => {
        const tokenA = await signSession(state.users.a, { role: "CUSTOMER", storeId: state.stores[1] });
        assert.equal((await run(0, () => auth.getSessionFromToken(tokenA))).role, "ADMIN");
        assert.equal((await run(1, () => auth.getSessionFromToken(tokenA))).role, "CUSTOMER");
        for (const name of ["global", "suspended", "inactive"]) assert.equal(await run(0, async () => auth.getSessionFromToken(await signSession(state.users[name]))), null);
        assert.equal(await run(0, () => auth.getSessionFromToken(tokenA.slice(0, -6) + "ALTERA")), null);
      });
      await check("redirect allowlist rechaza URLs, escapes, controles y destinos ambiguos", async () => {
        for (const next of ["https://fruvalle", "//fruvalle", "/\\fruvalle", "/%2f%2ffruvalle", "/admin\n", "/cuenta?next=//fruvalle", "/login"]) assert.throws(() => google.googleNextPath(next), { status: 400 });
        for (const next of ["/", "/checkout", "/cuenta", "/admin/orders"]) assert.equal(google.googleNextPath(next), next);
      });
      const intent = await run(0, () => google.createGoogleFlow({ acceptedTerms: true, next: "/checkout" }));
      await check("estado/nonce/PKCE cifrados, ligados a tienda y reclamables una vez bajo concurrencia", async () => {
        assert(intent.flow.verifier.length >= 43); assert.notEqual(intent.flow.state, intent.flow.nonce);
        assert(!intent.cookie.includes(intent.flow.verifier));
        const stored = await raw.oAuthAttempt.findUniqueOrThrow({ where: { stateHash: hash(intent.flow.state) } });
        assert(!Object.values(stored).includes(intent.flow.state)); assert(!Object.values(stored).includes(intent.flow.verifier));
        await assert.rejects(run(1, () => google.consumeGoogleFlow(intent.flow.state, intent.cookie)), { status: 400 });
        await assert.rejects(run(0, () => google.consumeGoogleFlow("á".repeat(intent.flow.state.length), intent.cookie)), { status: 400 });
        const attempts = await Promise.allSettled(Array.from({ length: 12 }, () => run(0, () => google.consumeGoogleFlow(intent.flow.state, intent.cookie))));
        assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
        assert(attempts.filter((attempt) => attempt.status === "rejected").every((attempt) => attempt.reason.status === 400));
      });
      const { privateKey, publicKey } = await generateKeyPair("RS256");
      const jwk = { ...await exportJWK(publicKey), kid: "E07-local", alg: "RS256" }; const keySet = createLocalJWKSet({ keys: [jwk] });
      const audience = "E07-local-unit-audience";
      const issue = (changes = {}) => new SignJWT({ nonce: intent.flow.nonce, email: "e07-google@variedadeslosprimos.com", email_verified: true, name: "E07 Google", ...changes }).setProtectedHeader({ alg: "RS256", kid: jwk.kid }).setIssuer("https://accounts.google.com").setAudience(audience).setSubject("E07-GOOGLE-SUBJECT").setIssuedAt().setExpirationTime("5m").sign(privateKey);
      const identity = await google.verifyGoogleIdToken(await issue(), intent.flow.nonce, audience, keySet);
      await check("issuer y vencimiento del ID token no se sustituyen por claims del navegador", async () => {
        const claims = { nonce: intent.flow.nonce, email: identity.email, email_verified: true };
        const wrongIssuer = await new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: jwk.kid }).setIssuer(contexts[0].origin).setAudience(audience).setSubject(identity.subject).setIssuedAt().setExpirationTime("5m").sign(privateKey);
        const expired = await new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: jwk.kid }).setIssuer("https://accounts.google.com").setAudience(audience).setSubject(identity.subject).setIssuedAt(Math.floor(Date.now() / 1000) - 120).setExpirationTime(Math.floor(Date.now() / 1000) - 60).sign(privateKey);
        for (const token of [wrongIssuer, expired]) await assert.rejects(google.verifyGoogleIdToken(token, intent.flow.nonce, audience, keySet), { status: 401 });
      });
      await check("estado expirado en DB o cookie alterada no se puede consumir", async () => {
        const result = await run(0, () => google.createGoogleFlow({}));
        const pieces = result.cookie.split("."); pieces[3] = (pieces[3][0] === "A" ? "B" : "A") + pieces[3].slice(1);
        await assert.rejects(run(0, () => google.consumeGoogleFlow(result.flow.state, pieces.join("."))), { status: 400 });
        await raw.oAuthAttempt.update({ where: { stateHash: hash(result.flow.state) }, data: { expiresAt: new Date(Date.now() - 1000) } });
        await assert.rejects(run(0, () => google.consumeGoogleFlow(result.flow.state, result.cookie)), { status: 400 });
        assert.equal((await raw.oAuthAttempt.findUniqueOrThrow({ where: { stateHash: hash(result.flow.state) } })).usedAt, null);
      });
      await check("validación criptográfica RS256, audience, nonce y correo verificado", async () => {
        assert.equal(identity.subject, "E07-GOOGLE-SUBJECT");
        await assert.rejects(google.verifyGoogleIdToken(await issue(), "NONCE-AJENO", audience, keySet), { status: 401 });
        await assert.rejects(google.verifyGoogleIdToken(await issue(), intent.flow.nonce, "AUDIENCE-AJENO", keySet), { status: 401 });
        await assert.rejects(google.verifyGoogleIdToken(await issue({ email_verified: false }), intent.flow.nonce, audience, keySet), { status: 401 });
        await assert.rejects(google.verifyGoogleIdToken((await issue()).slice(0, -8) + "ALTERADO", intent.flow.nonce, audience, keySet), { status: 401 });
      });
      await check("Google nuevo requiere consentimiento y solo crea CUSTOMER en la tienda actual", async () => {
        await assert.rejects(run(0, () => google.resolveGoogleAccount(identity, { ...intent.flow, acceptedTerms: false }, null)), { status: 400 });
        const user = await run(0, () => google.resolveGoogleAccount(identity, intent.flow, null));
        assert.equal(user.role, "CUSTOMER"); assert.equal(user.passwordHash, null); assert(user.termsAcceptedAt);
        assert.equal((await raw.storeMembership.findUniqueOrThrow({ where: { storeId_userId: { storeId: state.stores[0], userId: user.id } } })).role, "CUSTOMER");
        assert.equal(await raw.storeMembership.count({ where: { storeId: state.stores[1], userId: user.id } }), 0);
      });
      await check("correo coincidente no vincula ni toma la cuenta existente", async () => {
        const user = await raw.user.findUniqueOrThrow({ where: { id: state.users.a } });
        await assert.rejects(run(0, () => google.resolveGoogleAccount({ ...identity, subject: "E07-OTHER", email: user.email }, intent.flow, null)), { status: 409 });
        assert.equal((await raw.user.findUniqueOrThrow({ where: { id: user.id } })).googleId, null);
      });
      await check("vinculación exige mismo navegador/usuario/version y no modifica roles de otra tienda", async () => {
        const token = await signSession(state.users.a);
        const session = await run(0, () => auth.getSessionFromToken(token));
        const user = await raw.user.findUniqueOrThrow({ where: { id: state.users.a } });
        const link = await run(0, () => google.createGoogleFlow({ link: { userId: user.id, version: user.sessionVersion, sessionToken: token } }));
        await assert.rejects(run(0, () => google.consumeGoogleFlow(link.flow.state, link.cookie, "OTRO-NAVEGADOR")), { status: 400 });
        const flow = await run(0, () => google.consumeGoogleFlow(link.flow.state, link.cookie, token));
        await assert.rejects(run(0, () => google.resolveGoogleAccount({ ...identity, subject: "E07-LINKED", email: user.email }, flow, null)), { status: 401 });
        await run(0, () => google.resolveGoogleAccount({ ...identity, subject: "E07-LINKED", email: user.email }, flow, session));
        assert.equal(await run(0, () => auth.getSessionFromToken(token)), null);
        assert.equal((await raw.storeMembership.findUniqueOrThrow({ where: { storeId_userId: { storeId: state.stores[1], userId: user.id } } })).role, "CUSTOMER");
        const sameUser = await run(0, () => google.resolveGoogleAccount({ ...identity, subject: "E07-LINKED", email: "e07-owner@variedadeslosprimos.com" }, intent.flow, null));
        assert.equal(sameUser.id, user.id); assert.equal(sameUser.email, user.email);
      });
      await check("un subject vinculado no puede migrarse a otra identidad aunque coincida su correo", async () => {
        const user = await raw.user.findUniqueOrThrow({ where: { id: state.users.b } });
        const token = await signSession(user.id); const session = await run(1, () => auth.getSessionFromToken(token));
        const result = await run(1, () => google.createGoogleFlow({ link: { userId: user.id, version: user.sessionVersion, sessionToken: token } }));
        const flow = await run(1, () => google.consumeGoogleFlow(result.flow.state, result.cookie, token));
        await assert.rejects(run(1, () => google.resolveGoogleAccount({ ...identity, subject: "E07-LINKED", email: user.email }, flow, session)), { status: 409 });
        assert.deepEqual(await raw.user.findUniqueOrThrow({ where: { id: user.id } }), user);
      });
      console.log("Google local: JWT firmado con clave efímera solo de pruebas, verificador real con JWKS local; NO prueba real del proveedor ni credenciales OAuth ficticias.");
    } else {
      const port = Number(extra[0]); assert(port > 1024 && port < 65536);
      server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] });
      server.stdout.on("data", (data) => { serverLog += data; }); server.stderr.on("data", (data) => { serverLog += data; });
      let ready = false;
      for (let attempt = 0; attempt < 80; attempt++) {
        try { ready = (await request(port, state.hosts[0], "/api/cart")).status === 200; } catch { /* Solo este servidor de ensayo. */ }
        if (ready || server.exitCode !== null) break; await new Promise((resolve) => setTimeout(resolve, 500));
      }
      assert(ready, serverLog.slice(-3000));
      const call = (index, target, status = 200, body, cookie, method = body === undefined ? "GET" : "POST", headers = {}) => api(port, state.hosts[index], target, status, { method, body, headers: { cookie: cookie ?? "", ...headers } });
      const login = async (index, userId, password = "admin123") => {
        const user = await raw.user.findUniqueOrThrow({ where: { id: userId } });
        return call(index, "/api/auth/login", 200, { email: user.email, password });
      };
      if (mode === "baseline") {
        const result = await login(0, state.users.a), cookie = sessionCookie(result);
        const registered = await call(0, "/api/auth/register", 201, { name: "E07 baseline", email: "e07-baseline@variedadeslosprimos.com", password: "admin123", acceptedTerms: true });
        await fs.writeFile(contractFile, JSON.stringify({ login: shape(result.body), register: shape(registered.body), me: shape((await call(0, "/api/auth/me", 200, undefined, cookie)).body), profile: shape((await call(0, "/api/account", 200, undefined, cookie)).body) }, null, 2), { flag: "wx" });
        console.log("Contratos HTTP E06 capturados; sin SMTP ni Google real.");
      } else {
        const google = await import("../src/lib/server/google.ts");
        applicationClient = (await import("../src/lib/prisma.ts")).prisma;
        const contracts = JSON.parse(await fs.readFile(contractFile, "utf8"));
        let cookieA, cookieB, registeredCookie, registeredId;
        await check("email/password, /me y perfil conservan contratos y rol por tienda", async () => {
          const result = await login(0, state.users.a); cookieA = sessionCookie(result); assert(cookieA);
          assert.deepEqual(shape(result.body), contracts.login); assert.equal(result.body.data.role, "ADMIN");
          const other = await login(1, state.users.a); cookieB = sessionCookie(other); assert.equal(other.body.data.role, "CUSTOMER");
          assert.deepEqual(shape((await call(0, "/api/auth/me", 200, undefined, cookieA)).body), contracts.me);
          const profile = await call(1, "/api/account", 200, undefined, cookieA); assert.equal(profile.body.data.role, "CUSTOMER"); assert.deepEqual(shape(profile.body), contracts.profile);
          assert.equal(decodeJwt(cookieA.split("=")[1]).storeId, undefined);
        });
        await check("proxy y servicios: admin A no administra B; OWNER B sí administra B", async () => {
          await call(0, "/api/admin/categories", 200, undefined, cookieA);
          await call(0, "/api/admin/categories", 200, undefined, cookieB);
          await call(1, "/api/admin/categories", 403, undefined, cookieA);
          const owner = sessionCookie(await login(1, state.users.b)); await call(1, "/api/admin/categories", 200, undefined, owner);
          await call(0, "/api/admin/categories", 403, undefined, owner);
          const global = await raw.user.findUniqueOrThrow({ where: { id: state.users.global } });
          const result = await call(0, "/api/auth/login", 200, { email: global.email, password: "admin123", role: "ADMIN", storeId: state.stores[1] });
          assert.equal(result.body.data.role, "CUSTOMER"); await call(0, "/api/admin/categories", 403, undefined, sessionCookie(result));
        });
        await check("suspensión o desactivación invalida cookie existente sin confiar en claims", async () => {
          for (const name of ["suspended", "inactive"]) {
            const user = await raw.user.findUniqueOrThrow({ where: { id: state.users[name] } });
            await call(0, "/api/auth/login", 403, { email: user.email, password: "admin123" });
          }
          await raw.storeMembership.update({ where: { storeId_userId: { storeId: state.stores[0], userId: state.users.a } }, data: { active: false } });
          try { await call(0, "/api/admin/categories", 401, undefined, cookieA); }
          finally { await raw.storeMembership.update({ where: { storeId_userId: { storeId: state.stores[0], userId: state.users.a } }, data: { active: true } }); }
        });
        await check("registro conserva consentimiento y merge invitado, solo crea CUSTOMER actual", async () => {
          const guest = await call(0, "/api/cart/items", 201, { productId: "e05-A-plain", qty: 1 });
          const guestCookie = guest.headers["set-cookie"][0].split(";")[0];
          const body = { name: "E07 registro", email: "e07-register@variedadeslosprimos.com", password: "admin123", acceptedTerms: true, role: "ADMIN", storeId: state.stores[1] };
          await call(0, "/api/auth/register", 400, { ...body, acceptedTerms: false });
          const result = await call(0, "/api/auth/register", 201, body, guestCookie); registeredCookie = sessionCookie(result); registeredId = result.body.data.id;
          assert.deepEqual(shape(result.body), contracts.register); assert.equal(result.body.data.role, "CUSTOMER");
          assert.equal((await call(0, "/api/cart", 200, undefined, registeredCookie)).body.data.itemCount, 1);
          assert.equal(await raw.storeMembership.count({ where: { userId: registeredId, storeId: state.stores[1] } }), 0);
          await call(0, "/api/auth/register", 409, body);
        });
        await check("listado/búsqueda/objetivos admin limitados a membresías de la tienda", async () => {
          const list = (await call(0, "/api/admin/users", 200, undefined, cookieA)).body.data;
          assert(!list.some((user) => user.id === state.users.exclusive));
          await call(0, `/api/admin/users/${state.users.exclusive}`, 404, undefined, cookieA);
          const search = (await call(0, "/api/admin/search?q=e07-exclusive", 200, undefined, cookieA)).body.data; assert.equal(search.users.length, 0);
          const original = await raw.user.findUniqueOrThrow({ where: { id: state.users.shared } });
          await call(0, `/api/admin/users/${original.id}/password`, 403, { password: "admin123" }, cookieA);
          await call(0, `/api/admin/users/${original.id}`, 403, { name: original.name, email: "e07-takeover@variedadeslosprimos.com", role: "CUSTOMER", status: "ACTIVE" }, cookieA, "PATCH");
          assert.deepEqual(await raw.user.findUniqueOrThrow({ where: { id: original.id } }), original);
        });
        await check("alta administrativa asigna rol local y no ADMIN global", async () => {
          const created = (await call(0, "/api/admin/users", 201, { name: "E07 admin local", email: "e07-admin-local@variedadeslosprimos.com", role: "ADMIN", password: "admin123", status: "ACTIVE" }, cookieA)).body.data;
          assert.equal(created.role, "ADMIN"); assert.equal((await raw.user.findUniqueOrThrow({ where: { id: created.id } })).role, "CUSTOMER");
          assert.equal((await login(0, created.id)).body.data.role, "ADMIN"); assert.equal((await login(1, created.id)).body.data.role, "CUSTOMER");
          await call(0, `/api/admin/users/${state.users.shared}`, 200, undefined, cookieA, "DELETE");
          assert(await raw.user.findUnique({ where: { id: state.users.shared } }));
          assert(await raw.storeMembership.findUnique({ where: { storeId_userId: { storeId: state.stores[1], userId: state.users.shared } } }));
        });
        await check("recuperación uniforme, enlace propio, token hasheado y ajeno rechazado", async () => {
          const target = await raw.user.findUniqueOrThrow({ where: { id: registeredId } });
          const existing = await call(0, "/api/auth/password/forgot", 200, { email: target.email });
          const absent = await call(0, "/api/auth/password/forgot", 200, { email: "e07-absent@variedadeslosprimos.com" }); assert.deepEqual(existing.body, absent.body);
          const link = serverLog.match(/https:\/\/losprimos\/restablecer\?token=([a-f0-9]{64})/); assert(link, "No se capturó el enlace local sin SMTP");
          const token = link[1]; const stored = await raw.passwordResetToken.findUniqueOrThrow({ where: { tokenHash: hash(token) } });
          assert.equal(stored.storeId, state.stores[0]); assert.notEqual(stored.tokenHash, token);
          await call(1, "/api/auth/password/reset", 400, { token, password: "admin123" });
          const responses = await Promise.all([0, 1].map(() => request(port, state.hosts[0], "/api/auth/password/reset", { method: "POST", body: { token, password: "admin123" } })));
          assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400]);
          assert.equal((await call(0, "/api/auth/me", 200, undefined, registeredCookie)).body.data, null);
          registeredCookie = sessionCookie(await login(0, registeredId));
        });
        await check("cambio propio exige contraseña y revoca sesiones antiguas, preserva la actual", async () => {
          await call(0, "/api/account/password", 400, { currentPassword: "incorrecta", newPassword: "admin123" }, registeredCookie);
          const old = registeredCookie;
          const changed = await call(0, "/api/account/password", 200, { currentPassword: "admin123", newPassword: "admin123" }, old);
          registeredCookie = sessionCookie(changed); assert(registeredCookie);
          assert.equal((await call(0, "/api/auth/me", 200, undefined, old)).body.data, null);
          assert.equal((await call(0, "/api/auth/me", 200, undefined, registeredCookie)).body.data.id, registeredId);
        });
        await check("Google sin claves falla cerrado; link exige Origin y contraseña antes del flujo", async () => {
          await call(0, "/api/auth/google", 503);
          await call(0, "/api/auth/google/link", 403, { currentPassword: "admin123" }, cookieA);
          await call(0, "/api/auth/google/link", 403, { currentPassword: "incorrecta" }, cookieA, "POST", { origin: contexts[0].origin });
          await call(0, "/api/auth/google/link", 503, { currentPassword: "admin123" }, cookieA, "POST", { origin: contexts[0].origin });
        });
        await check("callback HTTP exige cookie/state/tienda y consume denegación una vez", async () => {
          const flow = await runWithStoreContext(contexts[0], () => google.createGoogleFlow({ next: "/cuenta" }));
          const cookie = `${flow.name}=${flow.cookie}`;
          await call(1, `/api/auth/google/callback?state=${flow.flow.state}&error=access_denied`, 400, undefined, cookie);
          await call(0, `/api/auth/google/callback?state=${flow.flow.state}&error=access_denied`, 400, undefined, cookie);
          assert((await raw.oAuthAttempt.findUniqueOrThrow({ where: { stateHash: hash(flow.flow.state) } })).usedAt);
          await call(0, `/api/auth/google/callback?state=${flow.flow.state}&code=used`, 400, undefined, cookie);
          assert.equal((await request(port, "unrecognized", "/api/auth/google")).status, 404);
        });
        await check("páginas de cuenta/admin mantienen render y guardia según membresía", async () => {
          assert.equal((await request(port, state.hosts[0], "/admin", { headers: { cookie: cookieA } })).status, 200);
          const denied = await request(port, state.hosts[1], "/admin", { headers: { cookie: cookieA } }); assert.equal(denied.status, 307); assert.equal(new URL(denied.headers.location).origin, contexts[1].origin);
          assert.equal((await request(port, state.hosts[0], "/cuenta", { headers: { cookie: registeredCookie } })).status, 200);
        });
        await check("límite de vinculación sigue la identidad, sin bypass por tienda o X-Forwarded-For", async () => {
          // Ya hubo dos intentos con Origin válido: contraseña errónea y falta de configuración.
          for (let index = 0; index < 3; index++) await call(0, "/api/auth/google/link", 403, { currentPassword: "incorrecta" }, cookieA, "POST", { origin: contexts[0].origin, "x-forwarded-for": String(index) });
          await call(1, "/api/auth/google/link", 429, { currentPassword: "incorrecta" }, cookieA, "POST", { origin: contexts[1].origin, "x-forwarded-for": "otro" });
        });
        await check("límite de cambio de contraseña no se evade con otra tienda o IP declarada", async () => {
          const user = await raw.user.findUniqueOrThrow({ where: { id: state.users.a } });
          for (let index = 0; index < 5; index++) await call(0, "/api/account/password", 400, { currentPassword: "incorrecta", newPassword: "admin123" }, cookieA, "POST", { "x-forwarded-for": String(index) });
          await call(1, "/api/account/password", 429, { currentPassword: "incorrecta", newPassword: "admin123" }, cookieA, "POST", { "x-forwarded-for": "otro" });
          assert.deepEqual(await raw.user.findUniqueOrThrow({ where: { id: user.id } }), user);
        });
        await check("límite de login ligado al correo global, no al host ni a cabeceras declaradas", async () => {
          const user = await raw.user.findUniqueOrThrow({ where: { id: state.users.exclusive } });
          for (let index = 0; index < 10; index++) await call(0, "/api/auth/login", 401, { email: user.email, password: "incorrecta" }, undefined, "POST", { "x-forwarded-for": String(index) });
          await call(1, "/api/auth/login", 429, { email: user.email, password: "admin123" }, undefined, "POST", { "x-forwarded-for": "otro" });
        });
      }
    }
  }
  console.log(`E07 ${mode}: ${checks} grupos correctos; solo ${database}; sin Google real ni SMTP.`);
} finally {
  if (server && server.exitCode === null) { const exited = new Promise((resolve) => server.once("exit", resolve)); server.kill(); await exited; }
  await applicationClient?.$disconnect(); await raw.$disconnect();
}
