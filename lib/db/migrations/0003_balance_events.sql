CREATE TABLE `balance_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trader_id` integer NOT NULL,
	`week_id` integer,
	`ticker_id` integer,
	`delta` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`type` text NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trader_id`) REFERENCES `traders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`week_id`) REFERENCES `weeks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ticker_id`) REFERENCES `tickers`(`id`) ON UPDATE no action ON DELETE no action
);
