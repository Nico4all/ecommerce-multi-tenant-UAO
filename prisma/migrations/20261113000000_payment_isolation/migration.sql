-- E06: respaldar y ensayar con escrituras detenidas antes del despliegue.
-- Todo el preflight precede al DDL persistente (MariaDB confirma DDL implícitamente).
SET SESSION check_constraint_checks = 1;
CREATE TEMPORARY TABLE e06_guard (valid BOOLEAN NOT NULL CHECK (valid = 1));
-- Sin referencia persistida no se puede reconstruir el orden de intentos empatados.
INSERT INTO e06_guard SELECT IF(COUNT(*) = 0, 1, 0) FROM (
  SELECT `orderId`, `createdAt` FROM `payments`
  GROUP BY `orderId`, `createdAt` HAVING COUNT(*) > 1 AND SUM(`method` = 'WOMPI') > 0
) ambiguous_attempts;
INSERT INTO e06_guard SELECT IF(COUNT(*) = 0, 1, 0) FROM (
  SELECT p.`method`, o.`code`, ROW_NUMBER() OVER (PARTITION BY p.`orderId` ORDER BY p.`createdAt`, p.`id`) AS attempt
  FROM `payments` p JOIN `orders` o ON o.`id` = p.`orderId`
) lengths WHERE `method` = 'WOMPI' AND CHAR_LENGTH(IF(attempt = 1, `code`, CONCAT(`code`, '-R', attempt))) > 191;

CREATE TEMPORARY TABLE e06_payment_plan (
  `id` VARCHAR(191) NOT NULL PRIMARY KEY,
  `gatewayReference` VARCHAR(191) NOT NULL,
  `gatewayTransactionId` VARCHAR(191) NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO e06_payment_plan
SELECT p.`id`, IF(p.attempt = 1, o.`code`, CONCAT(o.`code`, '-R', p.attempt)),
  NULLIF(SUBSTRING_INDEX(p.`reference`, ' (', 1), '')
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY `orderId` ORDER BY `createdAt`, `id`) AS attempt
  FROM `payments`
) p JOIN `orders` o ON o.`id` = p.`orderId` AND o.`storeId` = p.`storeId`
WHERE p.`method` = 'WOMPI';
INSERT INTO e06_guard SELECT IF(COUNT(*) = 0, 1, 0) FROM (
  SELECT `gatewayReference` FROM e06_payment_plan GROUP BY `gatewayReference` HAVING COUNT(*) > 1
  UNION ALL
  SELECT `gatewayTransactionId` FROM e06_payment_plan WHERE `gatewayTransactionId` IS NOT NULL
  GROUP BY `gatewayTransactionId` HAVING COUNT(*) > 1
) duplicate_gateway_ids;

ALTER TABLE `orders` ADD COLUMN `inventoryRestoredAt` DATETIME(3) NULL;
ALTER TABLE `payments`
  ADD COLUMN `gatewayReference` VARCHAR(191) NULL,
  ADD COLUMN `gatewayTransactionId` VARCHAR(191) NULL;
UPDATE `payments` p JOIN e06_payment_plan plan ON plan.`id` = p.`id`
SET p.`gatewayReference` = plan.`gatewayReference`, p.`gatewayTransactionId` = plan.`gatewayTransactionId`;
-- No modificar stock histórico ni reponer otra vez cancelaciones ya registradas.
UPDATE `orders` o LEFT JOIN (
  SELECT `storeId`, `orderId`, MIN(`createdAt`) AS cancelledAt
  FROM `order_status_events` WHERE `status` = 'CANCELLED' GROUP BY `storeId`, `orderId`
) e ON e.`storeId` = o.`storeId` AND e.`orderId` = o.`id`
SET o.`inventoryRestoredAt` = COALESCE(e.cancelledAt, o.`updatedAt`)
WHERE o.`status` = 'CANCELLED' OR e.cancelledAt IS NOT NULL;
CREATE UNIQUE INDEX `payments_gatewayReference_key` ON `payments` (`gatewayReference`);
CREATE UNIQUE INDEX `payments_gatewayTransactionId_key` ON `payments` (`gatewayTransactionId`);
DROP TEMPORARY TABLE e06_payment_plan;
DROP TEMPORARY TABLE e06_guard;
