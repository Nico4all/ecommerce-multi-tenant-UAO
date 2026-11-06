import { z } from "zod";

/**
 * Esquemas de los formularios de usuarios del panel (alta y reset de contraseña).
 * No es `server-only`: los usan los formularios en el cliente. La API revalida.
 */

/** Alta de usuario desde el panel. Un admin necesita contraseña; un cliente no. */
export const newUserFormSchema = z
  .object({
    name: z.string().trim().min(2, "Nombre muy corto"),
    email: z.email("Correo inválido"),
    phone: z.string().trim().optional(),
    role: z.enum(["CUSTOMER", "ADMIN"]),
    password: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const len = v.password?.length ?? 0;
    if (v.role === "ADMIN" && len < 8) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "Un administrador necesita una contraseña de al menos 8 caracteres",
      });
    } else if (len > 0 && len < 8) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "La contraseña debe tener al menos 8 caracteres",
      });
    }
  });
export type NewUserValues = z.infer<typeof newUserFormSchema>;

/** Reset de contraseña por el admin. */
export const adminResetPasswordFormSchema = z
  .object({
    password: z.string().min(8, "Al menos 8 caracteres"),
    confirm: z.string().min(1, "Repite la contraseña"),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });
export type AdminResetPasswordValues = z.infer<typeof adminResetPasswordFormSchema>;
