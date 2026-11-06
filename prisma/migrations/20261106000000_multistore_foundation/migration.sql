-- E02: ejecutar solo con respaldo verificado, ensayo y escrituras detenidas.
-- MariaDB hace commit implícito del DDL; la restauración del respaldo es el rollback.
-- Se exige validación de FKs; no heredar foreign_key_checks=0 de migraciones previas.
SET SESSION foreign_key_checks = 1;
SET SESSION alter_algorithm = 'DEFAULT';

-- Rechazar referencias históricas inválidas antes de cambiar tablas persistentes.
CREATE TEMPORARY TABLE e02_preflight_guard (valid BOOLEAN NOT NULL CHECK (valid = 1));
INSERT INTO e02_preflight_guard SELECT IF(COUNT(*) = 0, 1, 0) FROM (
SELECT c.`categorySlug` FROM `products` c LEFT JOIN `categories` p ON p.`slug` = c.`categorySlug` WHERE c.`categorySlug` IS NOT NULL AND p.`slug` IS NULL
UNION ALL
SELECT c.`productId` FROM `product_images` c LEFT JOIN `products` p ON p.`id` = c.`productId` WHERE c.`productId` IS NOT NULL AND p.`id` IS NULL
UNION ALL
SELECT c.`productId` FROM `product_specs` c LEFT JOIN `products` p ON p.`id` = c.`productId` WHERE c.`productId` IS NOT NULL AND p.`id` IS NULL
UNION ALL
SELECT c.`productId` FROM `product_variants` c LEFT JOIN `products` p ON p.`id` = c.`productId` WHERE c.`productId` IS NOT NULL AND p.`id` IS NULL
UNION ALL
SELECT c.`productId` FROM `reviews` c LEFT JOIN `products` p ON p.`id` = c.`productId` WHERE c.`productId` IS NOT NULL AND p.`id` IS NULL
UNION ALL
SELECT c.`cartId` FROM `cart_items` c LEFT JOIN `carts` p ON p.`id` = c.`cartId` WHERE c.`cartId` IS NOT NULL AND p.`id` IS NULL
UNION ALL
SELECT c.`productId` FROM `cart_items` c LEFT JOIN `products` p ON p.`id` = c.`productId` WHERE c.`productId` IS NOT NULL AND p.`id` IS NULL
UNION ALL
SELECT c.`variantId` FROM `cart_items` c LEFT JOIN `product_variants` p ON p.`id` = c.`variantId` WHERE c.`variantId` IS NOT NULL AND p.`id` IS NULL
UNION ALL
SELECT c.`productId` FROM `wishlist_items` c LEFT JOIN `products` p ON p.`id` = c.`productId` WHERE c.`productId` IS NOT NULL AND p.`id` IS NULL
UNION ALL
SELECT c.`orderId` FROM `order_items` c LEFT JOIN `orders` p ON p.`id` = c.`orderId` WHERE c.`orderId` IS NOT NULL AND p.`id` IS NULL
UNION ALL
SELECT c.`productId` FROM `order_items` c LEFT JOIN `products` p ON p.`id` = c.`productId` WHERE c.`productId` IS NOT NULL AND p.`id` IS NULL
UNION ALL
SELECT c.`variantId` FROM `order_items` c LEFT JOIN `product_variants` p ON p.`id` = c.`variantId` WHERE c.`variantId` IS NOT NULL AND p.`id` IS NULL
UNION ALL
SELECT c.`orderId` FROM `order_status_events` c LEFT JOIN `orders` p ON p.`id` = c.`orderId` WHERE c.`orderId` IS NOT NULL AND p.`id` IS NULL
UNION ALL
SELECT c.`orderId` FROM `payments` c LEFT JOIN `orders` p ON p.`id` = c.`orderId` WHERE c.`orderId` IS NOT NULL AND p.`id` IS NULL
UNION ALL
SELECT c.`codeId` FROM `discount_redemptions` c LEFT JOIN `discount_codes` p ON p.`id` = c.`codeId` WHERE c.`codeId` IS NOT NULL AND p.`id` IS NULL
UNION ALL
SELECT c.`orderId` FROM `discount_redemptions` c LEFT JOIN `orders` p ON p.`id` = c.`orderId` WHERE c.`orderId` IS NOT NULL AND p.`id` IS NULL
UNION ALL
SELECT c.`sectionId` FROM `banners` c LEFT JOIN `home_sections` p ON p.`id` = c.`sectionId` WHERE c.`sectionId` IS NOT NULL AND p.`id` IS NULL
UNION ALL
SELECT c.`categorySlug` FROM `home_sections` c LEFT JOIN `categories` p ON p.`slug` = c.`categorySlug` WHERE c.`categorySlug` IS NOT NULL AND p.`slug` IS NULL
UNION ALL
SELECT c.`orderId` FROM `email_logs` c LEFT JOIN `orders` p ON p.`id` = c.`orderId` WHERE c.`orderId` IS NOT NULL AND p.`id` IS NULL
UNION ALL
SELECT c.id FROM cart_items c JOIN product_variants v ON v.id=c.variantId WHERE v.productId<>c.productId
UNION ALL
SELECT c.id FROM order_items c JOIN product_variants v ON v.id=c.variantId WHERE c.productId IS NULL OR v.productId<>c.productId
) invalid_references;
DROP TEMPORARY TABLE e02_preflight_guard;

CREATE TABLE `stores` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT false,
    `legacyKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stores_slug_key`(`slug`),
    UNIQUE INDEX `stores_legacyKey_key`(`legacyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `store_domains` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `hostname` VARCHAR(253) NOT NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `store_domains_hostname_key`(`hostname`),
    INDEX `store_domains_storeId_idx`(`storeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `store_memberships` (
    `storeId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'CUSTOMER') NOT NULL DEFAULT 'CUSTOMER',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `store_memberships_userId_idx`(`userId`),
    PRIMARY KEY (`storeId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `store_settings` (
    `storeId` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'COP',
    `locale` VARCHAR(10) NOT NULL DEFAULT 'es-CO',
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`storeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO stores (id, slug, name, active, legacyKey, updatedAt)
VALUES ('store-original', 'variedades-los-primos', 'Variedades Los Primos', true, 'original', CURRENT_TIMESTAMP(3));
INSERT INTO store_settings (storeId, updatedAt) VALUES ('store-original', CURRENT_TIMESTAMP(3));
INSERT INTO store_memberships (storeId, userId, role, active)
SELECT 'store-original', id, IF(role = 'ADMIN', 'ADMIN', 'CUSTOMER'), status = 'ACTIVE' FROM users;

-- ADD COLUMN NOT NULL DEFAULT asigna la tienda original a TODAS las filas previas.
-- Las claves globales de orders.code y support_messages.radicado se conservan.
-- Mantener la FK global de usuario al cambiar la PK de favoritos.
CREATE INDEX wishlist_items_userId_idx ON wishlist_items (userId);

ALTER TABLE `products` DROP FOREIGN KEY `products_categorySlug_fkey`;

ALTER TABLE `product_images` DROP FOREIGN KEY `product_images_productId_fkey`;

ALTER TABLE `product_specs` DROP FOREIGN KEY `product_specs_productId_fkey`;

ALTER TABLE `product_variants` DROP FOREIGN KEY `product_variants_productId_fkey`;

ALTER TABLE `reviews` DROP FOREIGN KEY `reviews_productId_fkey`;

ALTER TABLE `carts` DROP FOREIGN KEY `carts_userId_fkey`;

ALTER TABLE `cart_items` DROP FOREIGN KEY `cart_items_cartId_fkey`;

ALTER TABLE `cart_items` DROP FOREIGN KEY `cart_items_productId_fkey`;

ALTER TABLE `cart_items` DROP FOREIGN KEY `cart_items_variantId_fkey`;

ALTER TABLE `wishlist_items` DROP FOREIGN KEY `wishlist_items_productId_fkey`;

ALTER TABLE `order_items` DROP FOREIGN KEY `order_items_orderId_fkey`;

ALTER TABLE `order_items` DROP FOREIGN KEY `order_items_productId_fkey`;

ALTER TABLE `order_items` DROP FOREIGN KEY `order_items_variantId_fkey`;

ALTER TABLE `order_status_events` DROP FOREIGN KEY `order_status_events_orderId_fkey`;

ALTER TABLE `payments` DROP FOREIGN KEY `payments_orderId_fkey`;

ALTER TABLE `discount_redemptions` DROP FOREIGN KEY `discount_redemptions_codeId_fkey`;

ALTER TABLE `discount_redemptions` DROP FOREIGN KEY `discount_redemptions_orderId_fkey`;

ALTER TABLE `banners` DROP FOREIGN KEY `banners_sectionId_fkey`;

ALTER TABLE `home_sections` DROP FOREIGN KEY `home_sections_categorySlug_fkey`;

ALTER TABLE `email_logs` DROP FOREIGN KEY `email_logs_orderId_fkey`;

DROP INDEX `products_slug_key` ON `products`;

DROP INDEX `products_sku_key` ON `products`;

DROP INDEX `products_categorySlug_idx` ON `products`;

DROP INDEX `product_variants_sku_key` ON `product_variants`;

DROP INDEX `carts_userId_key` ON `carts`;

DROP INDEX `carts_sessionId_key` ON `carts`;

DROP INDEX `discount_codes_code_key` ON `discount_codes`;

ALTER TABLE `categories` DROP PRIMARY KEY,
    ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original',
    ADD PRIMARY KEY (`storeId`, `slug`);

ALTER TABLE `products` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

ALTER TABLE `product_images` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

ALTER TABLE `product_specs` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

ALTER TABLE `product_variants` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

ALTER TABLE `reviews` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

ALTER TABLE `carts` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

ALTER TABLE `cart_items` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

ALTER TABLE `wishlist_items` DROP PRIMARY KEY,
    ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original',
    ADD PRIMARY KEY (`storeId`, `userId`, `productId`);

ALTER TABLE `orders` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

ALTER TABLE `order_items` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

ALTER TABLE `order_status_events` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

ALTER TABLE `payments` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

ALTER TABLE `discount_codes` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

ALTER TABLE `discount_redemptions` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

ALTER TABLE `banners` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

ALTER TABLE `home_sections` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

ALTER TABLE `email_logs` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

ALTER TABLE `notifications` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

ALTER TABLE `support_messages` ADD COLUMN `storeId` VARCHAR(191) NOT NULL DEFAULT 'store-original';

CREATE INDEX `products_storeId_categorySlug_idx` ON `products`(`storeId`, `categorySlug`);

CREATE UNIQUE INDEX `products_storeId_slug_key` ON `products`(`storeId`, `slug`);

CREATE UNIQUE INDEX `products_storeId_sku_key` ON `products`(`storeId`, `sku`);

CREATE UNIQUE INDEX `products_storeId_id_key` ON `products`(`storeId`, `id`);

CREATE INDEX `product_images_storeId_idx` ON `product_images`(`storeId`);

CREATE INDEX `product_specs_storeId_idx` ON `product_specs`(`storeId`);

CREATE UNIQUE INDEX `product_variants_storeId_sku_key` ON `product_variants`(`storeId`, `sku`);

CREATE UNIQUE INDEX `product_variants_storeId_productId_id_key` ON `product_variants`(`storeId`, `productId`, `id`);

CREATE UNIQUE INDEX `product_variants_storeId_id_key` ON `product_variants`(`storeId`, `id`);

CREATE INDEX `reviews_storeId_idx` ON `reviews`(`storeId`);

CREATE INDEX `carts_userId_idx` ON `carts`(`userId`);

CREATE UNIQUE INDEX `carts_storeId_id_key` ON `carts`(`storeId`, `id`);

CREATE UNIQUE INDEX `carts_storeId_userId_key` ON `carts`(`storeId`, `userId`);

CREATE UNIQUE INDEX `carts_storeId_sessionId_key` ON `carts`(`storeId`, `sessionId`);

CREATE INDEX `cart_items_storeId_idx` ON `cart_items`(`storeId`);

CREATE UNIQUE INDEX `orders_storeId_id_key` ON `orders`(`storeId`, `id`);

CREATE INDEX `order_items_storeId_idx` ON `order_items`(`storeId`);

CREATE INDEX `order_status_events_storeId_idx` ON `order_status_events`(`storeId`);

CREATE INDEX `payments_storeId_idx` ON `payments`(`storeId`);

CREATE UNIQUE INDEX `discount_codes_storeId_id_key` ON `discount_codes`(`storeId`, `id`);

CREATE UNIQUE INDEX `discount_codes_storeId_code_key` ON `discount_codes`(`storeId`, `code`);

CREATE INDEX `discount_redemptions_storeId_idx` ON `discount_redemptions`(`storeId`);

CREATE INDEX `banners_storeId_idx` ON `banners`(`storeId`);

CREATE UNIQUE INDEX `home_sections_storeId_id_key` ON `home_sections`(`storeId`, `id`);

CREATE INDEX `email_logs_storeId_idx` ON `email_logs`(`storeId`);

CREATE INDEX `notifications_storeId_idx` ON `notifications`(`storeId`);

CREATE INDEX `support_messages_storeId_idx` ON `support_messages`(`storeId`);

ALTER TABLE `store_domains` ADD CONSTRAINT `store_domains_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `store_memberships` ADD CONSTRAINT `store_memberships_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `store_memberships` ADD CONSTRAINT `store_memberships_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `store_settings` ADD CONSTRAINT `store_settings_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `categories` ADD CONSTRAINT `categories_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `products` ADD CONSTRAINT `products_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `products` ADD CONSTRAINT `products_storeId_categorySlug_fkey` FOREIGN KEY (`storeId`, `categorySlug`) REFERENCES `categories`(`storeId`, `slug`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `product_images` ADD CONSTRAINT `product_images_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `product_images` ADD CONSTRAINT `product_images_storeId_productId_fkey` FOREIGN KEY (`storeId`, `productId`) REFERENCES `products`(`storeId`, `id`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `product_specs` ADD CONSTRAINT `product_specs_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `product_specs` ADD CONSTRAINT `product_specs_storeId_productId_fkey` FOREIGN KEY (`storeId`, `productId`) REFERENCES `products`(`storeId`, `id`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_storeId_productId_fkey` FOREIGN KEY (`storeId`, `productId`) REFERENCES `products`(`storeId`, `id`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `reviews` ADD CONSTRAINT `reviews_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `reviews` ADD CONSTRAINT `reviews_storeId_productId_fkey` FOREIGN KEY (`storeId`, `productId`) REFERENCES `products`(`storeId`, `id`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `carts` ADD CONSTRAINT `carts_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_storeId_cartId_fkey` FOREIGN KEY (`storeId`, `cartId`) REFERENCES `carts`(`storeId`, `id`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_storeId_productId_fkey` FOREIGN KEY (`storeId`, `productId`) REFERENCES `products`(`storeId`, `id`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_storeId_productId_variantId_fkey` FOREIGN KEY (`storeId`, `productId`, `variantId`) REFERENCES `product_variants`(`storeId`, `productId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `wishlist_items` ADD CONSTRAINT `wishlist_items_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `wishlist_items` ADD CONSTRAINT `wishlist_items_storeId_productId_fkey` FOREIGN KEY (`storeId`, `productId`) REFERENCES `products`(`storeId`, `id`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `orders` ADD CONSTRAINT `orders_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `order_items` ADD CONSTRAINT `order_items_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `order_items` ADD CONSTRAINT `order_items_storeId_orderId_fkey` FOREIGN KEY (`storeId`, `orderId`) REFERENCES `orders`(`storeId`, `id`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `order_items` ADD CONSTRAINT `order_items_storeId_productId_fkey` FOREIGN KEY (`storeId`, `productId`) REFERENCES `products`(`storeId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `order_items` ADD CONSTRAINT `order_items_storeId_productId_variantId_fkey` FOREIGN KEY (`storeId`, `productId`, `variantId`) REFERENCES `product_variants`(`storeId`, `productId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `order_status_events` ADD CONSTRAINT `order_status_events_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `order_status_events` ADD CONSTRAINT `order_status_events_storeId_orderId_fkey` FOREIGN KEY (`storeId`, `orderId`) REFERENCES `orders`(`storeId`, `id`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `payments` ADD CONSTRAINT `payments_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `payments` ADD CONSTRAINT `payments_storeId_orderId_fkey` FOREIGN KEY (`storeId`, `orderId`) REFERENCES `orders`(`storeId`, `id`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `discount_codes` ADD CONSTRAINT `discount_codes_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `discount_redemptions` ADD CONSTRAINT `discount_redemptions_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `discount_redemptions` ADD CONSTRAINT `discount_redemptions_storeId_codeId_fkey` FOREIGN KEY (`storeId`, `codeId`) REFERENCES `discount_codes`(`storeId`, `id`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `discount_redemptions` ADD CONSTRAINT `discount_redemptions_storeId_orderId_fkey` FOREIGN KEY (`storeId`, `orderId`) REFERENCES `orders`(`storeId`, `id`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `banners` ADD CONSTRAINT `banners_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `banners` ADD CONSTRAINT `banners_storeId_sectionId_fkey` FOREIGN KEY (`storeId`, `sectionId`) REFERENCES `home_sections`(`storeId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `home_sections` ADD CONSTRAINT `home_sections_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `home_sections` ADD CONSTRAINT `home_sections_storeId_categorySlug_fkey` FOREIGN KEY (`storeId`, `categorySlug`) REFERENCES `categories`(`storeId`, `slug`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `email_logs` ADD CONSTRAINT `email_logs_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `email_logs` ADD CONSTRAINT `email_logs_storeId_orderId_fkey` FOREIGN KEY (`storeId`, `orderId`) REFERENCES `orders`(`storeId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `notifications` ADD CONSTRAINT `notifications_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `support_messages` ADD CONSTRAINT `support_messages_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `carts` ADD CONSTRAINT `carts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Una variante de snapshot no puede eludir su FK compuesta con productId NULL.
-- Retirar índices auxiliares de FKs antiguas reemplazados por claves compuestas.
DROP INDEX `cart_items_productId_fkey` ON `cart_items`;
DROP INDEX `cart_items_variantId_fkey` ON `cart_items`;
DROP INDEX `discount_redemptions_orderId_fkey` ON `discount_redemptions`;
DROP INDEX `home_sections_categorySlug_fkey` ON `home_sections`;
DROP INDEX `order_items_productId_fkey` ON `order_items`;
DROP INDEX `order_items_variantId_fkey` ON `order_items`;
DROP INDEX `wishlist_items_productId_fkey` ON `wishlist_items`;

ALTER TABLE order_items ADD CONSTRAINT e02_order_item_variant_product CHECK (variantId IS NULL OR productId IS NOT NULL);
