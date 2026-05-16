CREATE TABLE `balances` (
	`week_id` integer NOT NULL,
	`trader_id` integer NOT NULL,
	`points` integer NOT NULL,
	PRIMARY KEY(`week_id`, `trader_id`),
	FOREIGN KEY (`week_id`) REFERENCES `weeks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trader_id`) REFERENCES `traders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `holdings` (
	`week_id` integer NOT NULL,
	`trader_id` integer NOT NULL,
	`ticker_id` integer NOT NULL,
	`shares` integer NOT NULL,
	PRIMARY KEY(`week_id`, `trader_id`, `ticker_id`),
	FOREIGN KEY (`week_id`) REFERENCES `weeks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trader_id`) REFERENCES `traders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ticker_id`) REFERENCES `tickers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ticker_states` (
	`week_id` integer NOT NULL,
	`ticker_id` integer NOT NULL,
	`outstanding_shares` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`week_id`, `ticker_id`),
	FOREIGN KEY (`week_id`) REFERENCES `weeks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ticker_id`) REFERENCES `tickers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tickers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tickers_name_idx` ON `tickers` (`name`);--> statement-breakpoint
CREATE TABLE `traders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sub` text NOT NULL,
	`display_name` text NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `traders_sub_idx` ON `traders` (`sub`);--> statement-breakpoint
CREATE TABLE `trades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_id` integer NOT NULL,
	`trader_id` integer NOT NULL,
	`ticker_id` integer NOT NULL,
	`side` text NOT NULL,
	`shares` integer NOT NULL,
	`points` integer NOT NULL,
	`executed_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`week_id`) REFERENCES `weeks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trader_id`) REFERENCES `traders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ticker_id`) REFERENCES `tickers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `weeks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`is_active` integer DEFAULT true NOT NULL
);
