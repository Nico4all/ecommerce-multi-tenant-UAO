ALTER TABLE `store_settings`
  ADD COLUMN `senderEmail` VARCHAR(254) NULL,
  ADD COLUMN `notificationEmail` VARCHAR(254) NULL,
  ADD COLUMN `contactEmail` VARCHAR(254) NULL,
  ADD COLUMN `emailLogoUrl` VARCHAR(2048) NULL,
  ADD COLUMN `seoDescription` VARCHAR(500) NULL;
