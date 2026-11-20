CREATE TABLE `source_publication` (
	`id` integer PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`observed_at` text NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_sync_runs` (
	`day` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`status` text NOT NULL,
	`state_json` text NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_sync_runs_run_id_unique` ON `source_sync_runs` (`run_id`);