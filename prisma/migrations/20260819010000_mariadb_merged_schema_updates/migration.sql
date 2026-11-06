-- Ver la nota de 20260819000000_mariadb_init: añadir o quitar columnas hace
-- que InnoDB reconstruya la tabla, y ese renombrado de archivos falla cuando el
-- datadir de MariaDB vive en una carpeta de Windows montada en Docker
-- (errno 194 "Tablespace is missing"). En Linux estas dos opciones no cambian
-- nada, así que la migración sirve igual en el servidor.
SET SESSION foreign_key_checks = 0;
SET SESSION alter_algorithm = 'INPLACE';

-- Registra la aceptación de términos de las cuentas nuevas.
ALTER TABLE `users`
    ADD COLUMN `termsAcceptedAt` DATETIME(3) NULL;

-- Conserva el significado anterior: freeShipping=true equivale a costo 0;
-- NULL hace que el producto use la tarifa general de la tienda.
ALTER TABLE `products`
    ADD COLUMN `shippingCost` DECIMAL(10, 2) NULL;

UPDATE `products`
SET `shippingCost` = 0
WHERE `freeShipping` = true;

ALTER TABLE `products`
    DROP COLUMN `freeShipping`;

-- MariaDB almacena los enums de Prisma directamente en la columna.
ALTER TABLE `payments`
    MODIFY `method` ENUM(
        'CARD',
        'PAYPAL',
        'EFECTY',
        'TRANSFER',
        'PSE',
        'WOMPI',
        'COD'
    ) NOT NULL;
