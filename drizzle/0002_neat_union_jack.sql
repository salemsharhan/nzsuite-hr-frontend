CREATE TABLE `leave_adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leaveBalanceId` int NOT NULL,
	`adjustmentType` enum('Add','Deduct') NOT NULL,
	`amount` decimal(5,2) NOT NULL,
	`reason` text NOT NULL,
	`adjustedBy` int NOT NULL,
	`adjustedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leave_adjustments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leave_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leaveRequestId` int NOT NULL,
	`approverRole` varchar(50) NOT NULL,
	`approverId` int,
	`action` enum('Approved','Rejected','Pending') NOT NULL,
	`comments` text,
	`actionAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leave_approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leave_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`leaveTypeId` int NOT NULL,
	`year` int NOT NULL,
	`totalEntitled` decimal(5,2) NOT NULL,
	`used` decimal(5,2) NOT NULL DEFAULT '0',
	`pending` decimal(5,2) NOT NULL DEFAULT '0',
	`carriedForward` decimal(5,2) NOT NULL DEFAULT '0',
	`remaining` decimal(5,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leave_balances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leave_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leaveTypeId` int NOT NULL,
	`annualEntitlement` int NOT NULL,
	`accrualMethod` enum('monthly','yearly','joining_date') NOT NULL DEFAULT 'yearly',
	`carryForwardEnabled` boolean NOT NULL DEFAULT false,
	`maxCarryForwardDays` int DEFAULT 0,
	`encashmentEnabled` boolean NOT NULL DEFAULT false,
	`minDaysPerRequest` int DEFAULT 1,
	`maxDaysPerRequest` int,
	`advanceNoticeRequired` int DEFAULT 0,
	`requiresApproval` boolean NOT NULL DEFAULT true,
	`requiresAttachment` boolean NOT NULL DEFAULT false,
	`applicableTo` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leave_policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` varchar(50) NOT NULL,
	`employeeId` int NOT NULL,
	`leaveTypeId` int NOT NULL,
	`startDate` date NOT NULL,
	`endDate` date NOT NULL,
	`duration` decimal(5,2) NOT NULL,
	`reason` text,
	`attachments` json,
	`status` enum('Pending','Approved','Rejected','Cancelled') NOT NULL DEFAULT 'Pending',
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	`reviewedBy` int,
	`reviewComments` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leave_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `leave_requests_requestId_unique` UNIQUE(`requestId`)
);
--> statement-breakpoint
CREATE TABLE `leave_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`code` varchar(20) NOT NULL,
	`description` text,
	`color` varchar(7) DEFAULT '#3b82f6',
	`icon` varchar(50),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leave_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `leave_types_name_unique` UNIQUE(`name`),
	CONSTRAINT `leave_types_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `public_holidays` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`date` date NOT NULL,
	`isRecurring` boolean NOT NULL DEFAULT false,
	`applicableTo` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `public_holidays_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leave_adjustments` ADD CONSTRAINT `leave_adjustments_leaveBalanceId_leave_balances_id_fk` FOREIGN KEY (`leaveBalanceId`) REFERENCES `leave_balances`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_adjustments` ADD CONSTRAINT `leave_adjustments_adjustedBy_users_id_fk` FOREIGN KEY (`adjustedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_approvals` ADD CONSTRAINT `leave_approvals_leaveRequestId_leave_requests_id_fk` FOREIGN KEY (`leaveRequestId`) REFERENCES `leave_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_approvals` ADD CONSTRAINT `leave_approvals_approverId_users_id_fk` FOREIGN KEY (`approverId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_balances` ADD CONSTRAINT `leave_balances_employeeId_employees_id_fk` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_balances` ADD CONSTRAINT `leave_balances_leaveTypeId_leave_types_id_fk` FOREIGN KEY (`leaveTypeId`) REFERENCES `leave_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_policies` ADD CONSTRAINT `leave_policies_leaveTypeId_leave_types_id_fk` FOREIGN KEY (`leaveTypeId`) REFERENCES `leave_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_employeeId_employees_id_fk` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_leaveTypeId_leave_types_id_fk` FOREIGN KEY (`leaveTypeId`) REFERENCES `leave_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_reviewedBy_users_id_fk` FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;