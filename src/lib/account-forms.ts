import { z } from "zod";

/**
 * Esquemas de los formularios de cuenta y recuperación de contraseña.
 *
 * NO es `server-only`: lo usan los formularios (react-hook-form) en el cliente.
 * La API revalida por su cuenta con sus propios esquemas (nunca se confía en el
 * cliente); estos añaden la comprobación de "repite la contraseña", que es solo
 * de UI y no viaja al servidor.
 */

const password = z.string().min(8, "Al menos 8 caracteres");
const confirm = z.string().min(1, "Repite la contraseña");
const matches = (v: { password?: string; newPassword?: string; confirm: string }) =>
  (v.password ?? v.newPassword) === v.confirm;

/** Cambiar la contraseña estando dentro (perfil). */
export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: password,
    confirm,
  })
  .refine(matches, { message: "Las contraseñas no coinciden", path: ["confirm"] });
export type ChangePasswordValues = z.infer<typeof changePasswordFormSchema>;

/** Pedir el enlace de recuperación. */
export const forgotFormSchema = z.object({
  email: z.email("Correo inválido"),
});
export type ForgotValues = z.infer<typeof forgotFormSchema>;

/** Fijar la nueva contraseña desde el enlace. */
export const resetPasswordFormSchema = z
  .object({ password, confirm })
  .refine(matches, { message: "Las contraseñas no coinciden", path: ["confirm"] });
export type ResetPasswordValues = z.infer<typeof resetPasswordFormSchema>;

/** Editar el perfil (cuenta completa del cliente). */
export const profileFormSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre completo"),
  phone: z.string().trim().optional(),
  street: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zip: z.string().trim().optional(),
  country: z.string().trim().optional(),
});
export type ProfileValues = z.infer<typeof profileFormSchema>;
