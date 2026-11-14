-- E07: cambios aditivos; conservar membresías, roles históricos y contraseñas.
ALTER TABLE `users` ADD COLUMN `sessionVersion` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `users` MODIFY `googleId` VARCHAR(255) NULL;
-- Los enlaces históricos apuntaban al storefront original. Conservarlos allí.
ALTER TABLE `password_reset_tokens`
  ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original',
  ADD COLUMN `sessionVersion` INTEGER NOT NULL DEFAULT 0;
CREATE INDEX `password_reset_tokens_storeId_userId_idx` ON `password_reset_tokens` (`storeId`, `userId`);
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_storeId_fkey`
  FOREIGN KEY (`storeId`) REFERENCES `stores` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE TABLE `oauth_attempts` (
  `stateHash` CHAR(64) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`stateHash`),
  INDEX `oauth_attempts_storeId_expiresAt_idx` (`storeId`, `expiresAt`),
  INDEX `oauth_attempts_userId_idx` (`userId`),
  CONSTRAINT `oauth_attempts_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `oauth_attempts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
