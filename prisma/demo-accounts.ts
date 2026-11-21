import bcrypt from "bcryptjs";
import type { PrismaClient } from "../src/generated/prisma/client";

export const demoStoreAdmins = [
  { id: "demo-admin-0", email: "admin@variedades.com", legacyEmail: "e08-admin-a@variedadeslosprimos.com", storeId: "store-original", name: "Administrador Variedades Los Primos", role: "ADMIN" },
  { id: "demo-admin-1", email: "admin@fruvalle.com", legacyEmail: "e08-admin-b@variedadeslosprimos.com", storeId: "store-frutas-del-valle", name: "Administrador Frutas del Valle", role: "OWNER" },
] as const;

/** Aprovisionamiento explícito y exclusivo de las cuentas del laboratorio. */
export async function provisionDemoAccounts(prisma: PrismaClient, dryRun = false) {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!process.argv.includes("--local-demo") || process.env.NODE_ENV === "production" ||
    !["database", "localhost", "127.0.0.1"].includes(url.hostname) ||
    !/^(multitienda_demo|integration_rehearsal_[a-z0-9_]+)$/.test(url.pathname.slice(1))) {
    throw new Error("Las cuentas de muestra solo se aprovisionan en el laboratorio local explícito");
  }
  const accounts = [...demoStoreAdmins.map(account => ({ ...account, platformRole: "NONE" as const })),
    { id: "demo-platform-admin", email: "admin@admin.com", legacyEmail: "admin@admin.com", name: "Administrador de plataforma", platformRole: "ADMIN" as const }];
  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.$transaction(async tx => {
    for (const account of accounts) {
      const existing = await tx.user.findUnique({ where: { id: account.id } });
      const owner = await tx.user.findUnique({ where: { email: account.email }, select: { id: true } });
      if ((owner && owner.id !== account.id) || (existing && ![account.email, account.legacyEmail].includes(existing.email))) {
        throw new Error(`La identidad de muestra colisiona con otra cuenta: ${account.id}`);
      }
      const changed = existing && (existing.email !== account.email || existing.platformRole !== account.platformRole ||
        existing.status !== "ACTIVE" || !existing.passwordHash || !await bcrypt.compare("admin123", existing.passwordHash));
      console.log(`${dryRun ? "SIMULACIÓN" : "APLICAR"}: ${account.id} → ${account.email}; permiso de plataforma ${account.platformRole}`);
      if (dryRun) continue;
      await tx.user.upsert({
        where: { id: account.id },
        create: { id: account.id, name: account.name, email: account.email, passwordHash, role: "CUSTOMER", platformRole: account.platformRole, termsAcceptedAt: new Date() },
        update: changed ? { email: account.email, passwordHash, status: "ACTIVE", platformRole: account.platformRole, sessionVersion: { increment: 1 } } : {},
      });
    }
    if (dryRun) return;
    for (const account of demoStoreAdmins) {
      await tx.storeMembership.upsert({ where: { storeId_userId: { storeId: account.storeId, userId: account.id } },
        create: { storeId: account.storeId, userId: account.id, role: account.role }, update: { role: account.role, active: true } });
      await tx.storeSettings.updateMany({ where: { storeId: account.storeId, notificationEmail: { in: [account.legacyEmail, account.email] } }, data: { notificationEmail: account.email } });
    }
  }, { timeout: 30000 });
}
