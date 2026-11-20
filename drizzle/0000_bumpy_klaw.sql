CREATE TABLE `admin_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`settings_revision` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
