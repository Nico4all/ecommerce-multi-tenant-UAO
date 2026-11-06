import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

/**
 * Almacenamiento de archivos subidos desde el panel.
 *
 * Los archivos viven en `uploads/` en la raíz del proyecto, FUERA de `public/`:
 * así no dependemos de que Next copie la carpeta al construir, y quien los sirve
 * es `/api/uploads/[...path]`, que controla el content-type y la caché.
 * En la BD solo se guarda la ruta pública, nunca el binario.
 *
 * Todo se aísla detrás de esta capa: para migrar a S3 o Cloudinary basta con
 * reimplementar estas cuatro funciones.
 */

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

/** Prefijo público. Debe coincidir con la ruta del route handler que sirve. */
export const PUBLIC_PREFIX = "/api/uploads";

/**
 * Resuelve una ruta relativa dentro de `uploads/` y verifica que no se escape.
 * Sin esto, un `../../.env` en la URL leería archivos del servidor.
 */
export function resolveUploadPath(relative: string): string | null {
  // Se normaliza y se comprueba que el resultado siga colgando de UPLOAD_DIR.
  const target = path.resolve(UPLOAD_DIR, relative);
  const base = path.resolve(UPLOAD_DIR);
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  return target;
}

/** Guarda el binario y devuelve su ruta pública (lo que va a la BD). */
export async function saveUpload(
  data: Buffer,
  ext: string,
): Promise<{ url: string; key: string }> {
  // Se agrupa por año-mes para que la carpeta no acabe con miles de archivos.
  const now = new Date();
  const folder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const name = `${randomUUID()}.${ext}`;
  const key = `${folder}/${name}`;

  const target = resolveUploadPath(key);
  if (!target) throw new Error("Ruta de subida inválida");

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);

  return { url: `${PUBLIC_PREFIX}/${key}`, key };
}

/** Lee un archivo ya subido. `null` si no existe o si la ruta se sale. */
export async function readUpload(relative: string): Promise<Buffer | null> {
  const target = resolveUploadPath(relative);
  if (!target) return null;
  try {
    return await readFile(target);
  } catch {
    return null;
  }
}

/**
 * Convierte una ruta pública (`/api/uploads/2026-07/x.webp`) en su key
 * (`2026-07/x.webp`). Devuelve `null` si la URL no es de nuestro almacén
 * (p.ej. una imagen externa o un placeholder del seed): así la limpieza de
 * huérfanos nunca confunde un enlace ajeno con un archivo local.
 */
export function keyFromPublicUrl(url: string): string | null {
  const prefix = `${PUBLIC_PREFIX}/`;
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  // Se valida por la misma vía que al leer: descarta `../` y rutas raras.
  return resolveUploadPath(key) ? key : null;
}

/** Un archivo en `uploads/` con su tamaño en bytes. */
export interface UploadEntry {
  key: string;
  size: number;
}

/**
 * Lista todos los archivos bajo `uploads/` (recorriendo las subcarpetas
 * año-mes) con su tamaño. Carpeta inexistente o vacía => `[]`.
 */
export async function listUploads(): Promise<UploadEntry[]> {
  let entries: string[];
  try {
    // Sin `withFileTypes`: devuelve rutas relativas a UPLOAD_DIR (con separador
    // del SO). Recorre las subcarpetas año-mes.
    entries = await readdir(UPLOAD_DIR, { recursive: true });
  } catch {
    return []; // aún no se ha subido nada
  }

  const out: UploadEntry[] = [];
  for (const entry of entries) {
    const abs = path.join(UPLOAD_DIR, entry);
    try {
      const info = await stat(abs);
      if (!info.isFile()) continue; // se saltan las carpetas año-mes
      out.push({ key: entry.split(path.sep).join("/"), size: info.size });
    } catch {
      // desapareció entre el listado y el stat: se ignora
    }
  }
  return out;
}

/** Borra un archivo subido. `true` si se borró, `false` si no existía o la ruta se sale. */
export async function deleteUpload(key: string): Promise<boolean> {
  const target = resolveUploadPath(key);
  if (!target) return false;
  try {
    await unlink(target);
    return true;
  } catch {
    return false;
  }
}
