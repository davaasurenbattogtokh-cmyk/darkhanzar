CREATE TABLE `market_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`data_json` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`promoted_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `market_uploads` (
	`path` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `promotion_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`client_key` text NOT NULL,
	`active_slot` text,
	`plan_id` text NOT NULL,
	`plan_label` text NOT NULL,
	`days` integer NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`callback_hash` text NOT NULL,
	`invoice_id` text,
	`qr_json` text,
	`created_at` integer NOT NULL,
	`paid_at` integer,
	`check_lease_until` integer DEFAULT 0 NOT NULL,
	`last_checked_at` integer DEFAULT 0 NOT NULL,
	`payment_ids_json` text,
	`error_code` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promotion_orders_client_key_unique` ON `promotion_orders` (`client_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `promotion_orders_active_slot_unique` ON `promotion_orders` (`active_slot`);--> statement-breakpoint
CREATE UNIQUE INDEX `promotion_orders_invoice_id_unique` ON `promotion_orders` (`invoice_id`);