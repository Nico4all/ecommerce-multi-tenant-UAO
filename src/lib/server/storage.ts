import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile, readdir, lstat, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma, getStoreContext } from "@/lib/prisma";
import { ORIGINAL_STORE_ID } from "../../../prisma/stores";
import { ApiError } from "./api-helpers";

// Datos de ejecución: el bundle no debe incorporar archivos subidos ni inferir el proyecto entero.
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
export const PUBLIC_PREFIX = "/api/uploads";
export const storeUploadPrefix = (storeId: string) => `stores/${createHash("sha256").update(storeId).digest("hex")}/`;

export function uploadKeyBelongsToStore(key: string, storeId: string): boolean {
  if (/[\\%:\x00-\x1f\x7f]/.test(key) || key.split("/").some((part) => !part || part === "." || part === "..")) return false;
  if (key.startsWith("stores/")) return key.startsWith(storeUploadPrefix(storeId));
  return storeId === ORIGINAL_STORE_ID && /^\d{4}-\d{2}\/[^/]+$/.test(key);
}

/** Comprobación léxica; las operaciones también rechazan enlaces simbólicos. */
export function resolveUploadPath(relative: string): string | null {
  const target = path.resolve(UPLOAD_DIR, relative), base = path.resolve(UPLOAD_DIR);
  return target === base || target.startsWith(base + path.sep) ? target : null;
}

async function checkedPath(relative: string, createParents = false): Promise<string | null> {
  const target = resolveUploadPath(relative);
  if (!target || /[\\%:\x00-\x1f\x7f]/.test(relative) || relative.split("/").some((part) => !part || part === "." || part === "..")) return null;
  if (createParents) await mkdir(UPLOAD_DIR, { recursive: true });
  try {
    const root = await lstat(/* turbopackIgnore: true */ UPLOAD_DIR);
    if (!root.isDirectory() || root.isSymbolicLink()) return null;
    const parts = relative.split("/");
    for (let index = 0; index < parts.length; index++) {
      const current = path.join(UPLOAD_DIR, ...parts.slice(0, index + 1));
      let info;
      try { info = await lstat(/* turbopackIgnore: true */ current); }
      catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
        if (index === parts.length - 1) return target;
        if (!createParents) return null;
        await mkdir(current, { recursive: true });
        info = await lstat(/* turbopackIgnore: true */ current);
      }
      if (info.isSymbolicLink() || (index < parts.length - 1 && !info.isDirectory())) return null;
    }
    return target;
  } catch { return null; }
}

export async function saveUpload(data: Buffer, ext: string): Promise<{ url: string; key: string }> {
  const { id: storeId } = await getStoreContext();
  if (!/^[a-z\d]+$/i.test(ext)) throw new ApiError(400, "Extensión de subida inválida");
  const now = new Date();
  const folder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const key = `${storeUploadPrefix(storeId)}${folder}/${randomUUID()}.${ext}`;
  const target = await checkedPath(key, true);
  if (!target) throw new ApiError(403, "Ruta de subida no permitida");
  await writeFile(target, data, { flag: "wx" });
  return { url: `${PUBLIC_PREFIX}/${key}`, key };
}

export async function readUpload(relative: string): Promise<Buffer | null> {
  const { id: storeId } = await getStoreContext();
  if (!uploadKeyBelongsToStore(relative, storeId)) return null;
  const target = await checkedPath(relative);
  if (!target) return null;
  try { return await readFile(/* turbopackIgnore: true */ target); } catch { return null; }
}

/** Canonicalizar URL absoluta/relativa y query sin confundir claves de otra tienda. */
export function keyFromPublicUrl(value: string): string | null {
  try {
    const pathname = value.startsWith("/") ? value.split(/[?#]/)[0] : new URL(value).pathname;
    const decoded = decodeURIComponent(pathname);
    if (/[\\%:\x00-\x1f\x7f]/.test(decoded) || decoded.split("/").some((part) => part === "." || part === "..")) return null;
    if (!decoded.startsWith(PUBLIC_PREFIX + "/")) return null;
    const key = decoded.slice(PUBLIC_PREFIX.length + 1);
    return resolveUploadPath(key) ? key : null;
  } catch { return null; }
}

/** Antes de guardar una referencia, comprobar también namespace y dominio de uploads. */
export async function assertImageReferences(values: (string | null | undefined)[]) {
  const store = await getStoreContext();
  for (const value of values) {
    if (!value) continue;
    let absolute: URL | undefined;
    try { if (!value.startsWith("/")) absolute = new URL(value); }
    catch { throw new ApiError(400, "URL de imagen inválida"); }
    if (value.startsWith("//") || (absolute && (!["http:", "https:"].includes(absolute.protocol) || absolute.username || absolute.password))) throw new ApiError(400, "URL de imagen no permitida");
    let decoded: string;
    try { decoded = decodeURIComponent(absolute?.pathname ?? value.split(/[?#]/)[0]); }
    catch { throw new ApiError(400, "URL de imagen inválida"); }
    if (decoded.startsWith(PUBLIC_PREFIX)) {
      const key = keyFromPublicUrl(value);
      if (!key || !uploadKeyBelongsToStore(key, store.id)) throw new ApiError(403, "La imagen pertenece a otra tienda o su ruta es inválida");
      if (absolute && absolute.origin !== store.origin) {
        const domain = absolute.protocol === "https:" && !absolute.port && await prisma.storeDomain.findFirst({
          where: { storeId: store.id, hostname: absolute.hostname, verifiedAt: { not: null } }, select: { id: true },
        });
        if (!domain) throw new ApiError(403, "El dominio de la imagen no pertenece a esta tienda");
      }
    }
  }
}

export interface UploadEntry { key: string; size: number }

/** Recorrer únicamente el namespace propio; no seguir symlinks ni enumerar otras tiendas. */
export async function listUploads(): Promise<UploadEntry[]> {
  const { id: storeId } = await getStoreContext();
  const roots = [storeUploadPrefix(storeId).slice(0, -1)];
  if (storeId === ORIGINAL_STORE_ID) {
    try { roots.push(...(await readdir(/* turbopackIgnore: true */ UPLOAD_DIR)).filter((name) => /^\d{4}-\d{2}$/.test(name))); } catch { /* Sin archivos históricos. */ }
  }
  const out: UploadEntry[] = [];
  const visit = async (relative: string): Promise<void> => {
    const target = await checkedPath(relative);
    if (!target) return;
    try {
      const info = await lstat(/* turbopackIgnore: true */ target);
      if (info.isSymbolicLink()) return;
      if (info.isDirectory()) {
        for (const name of await readdir(/* turbopackIgnore: true */ target)) await visit(`${relative}/${name}`);
      } else if (info.isFile() && uploadKeyBelongsToStore(relative, storeId)) out.push({ key: relative, size: info.size });
    } catch { /* Un archivo puede desaparecer durante el recorrido. */ }
  };
  for (const root of roots) await visit(root);
  return out;
}

export async function deleteUpload(key: string): Promise<boolean> {
  const { id: storeId } = await getStoreContext();
  if (!uploadKeyBelongsToStore(key, storeId)) return false;
  const target = await checkedPath(key);
  if (!target) return false;
  try { await unlink(target); return true; } catch { return false; }
}
