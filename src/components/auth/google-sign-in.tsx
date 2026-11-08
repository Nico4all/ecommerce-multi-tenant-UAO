import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Acceso con Google: reservado, no activo.
 *
 * `GOOGLE_OAUTH_START_PATH` es la ruta que iniciaría el flujo OAuth. Hoy vale
 * `null` a propósito, porque en esta rama NO existe ninguna ruta OAuth:
 * `src/app/api/auth` solo expone login, logout, me, register y las dos de
 * contraseña. Restituir ese acceso es la historia E07.
 *
 * Mientras valga `null`, este componente no pinta nada. Un botón que no lleva
 * a ninguna parte, o que simula haber entrado, engaña al cliente; y tampoco se
 * inventa aquí una variable de entorno para fingir la condición: lo que habilita
 * el botón es que la ruta exista de verdad en el proyecto.
 *
 * Cuando E07 la publique, basta apuntarla aquí y las pantallas de entrar y
 * registrarse lo muestran sin más cambios.
 */
export const GOOGLE_OAUTH_START_PATH: string | null = null;

/**
 * Botón de Google más el separador que lo despega del formulario de correo.
 * Devuelve `null` entero: sin ruta no queda ni el separador suelto.
 *
 * El logotipo oficial de Google tiene que salir de su propio kit de marca y
 * aquí no hay un activo autorizado, así que el botón va con texto. Redibujar
 * la "G" de memoria sería falsificar una marca ajena, lo mismo que el proyecto
 * ya evita con el logotipo institucional.
 */
export function GoogleSignIn({
  next,
  label = "Continuar con Google",
}: {
  /** A dónde volver después de entrar, si se venía de una página concreta. */
  next?: string | null;
  label?: string;
}) {
  if (!GOOGLE_OAUTH_START_PATH) return null;

  const href = next
    ? `${GOOGLE_OAUTH_START_PATH}?next=${encodeURIComponent(next)}`
    : GOOGLE_OAUTH_START_PATH;

  return (
    <div className="mb-5 space-y-5">
      {/* Enlace, no botón: inicia una navegación de servidor, no un fetch. */}
      <a
        href={href}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-11 w-full text-base",
        )}
      >
        {label}
      </a>
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          o con tu correo
        </span>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
