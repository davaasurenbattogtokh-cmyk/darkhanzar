CREATE TABLE `source_detail_runs` (
	`run_id` text PRIMARY KEY NOT NULL,
	`base_key` text NOT NULL,
	`status` text NOT NULL,
	`state_json` text NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_detail_runs_base_key_unique` ON `source_detail_runs` (`base_key`);