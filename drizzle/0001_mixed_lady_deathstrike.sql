CREATE TABLE `attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`date` timestamp NOT NULL,
	`checkIn` timestamp,
	`checkOut` timestamp,
	`status` enum('Present','Absent','Late','Half Day','On Leave') NOT NULL DEFAULT 'Present',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(100) NOT NULL,
	`entityId` varchar(100) NOT NULL,
	`changes` json,
	`performedBy` varchar(200) NOT NULL,
	`performedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int,
	`documentName` varchar(200) NOT NULL,
	`documentType` varchar(100) NOT NULL,
	`fileUrl` text NOT NULL,
	`uploadedBy` int,
	`expiryDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` varchar(50) NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(20),
	`department` varchar(100),
	`position` varchar(100),
	`hireDate` timestamp,
	`salary` decimal(10,2),
	`status` enum('Active','Inactive','On Leave') NOT NULL DEFAULT 'Active',
	`employmentType` enum('Full Time','Part Time','Consultant') NOT NULL DEFAULT 'Full Time',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`),
	CONSTRAINT `employees_employeeId_unique` UNIQUE(`employeeId`),
	CONSTRAINT `employees_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `hiringChecklists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`stage` int NOT NULL DEFAULT 1,
	`progressPercentage` int NOT NULL DEFAULT 0,
	`status` enum('In Progress','Pending Approval','Completed') NOT NULL DEFAULT 'In Progress',
	`hrApproved` boolean NOT NULL DEFAULT false,
	`hrApprovedBy` varchar(200),
	`hrApprovedDate` timestamp,
	`managerApproved` boolean NOT NULL DEFAULT false,
	`managerApprovedBy` varchar(200),
	`managerApprovedDate` timestamp,
	`items` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hiringChecklists_id` PRIMARY KEY(`id`),
	CONSTRAINT `hiringChecklists_employeeId_unique` UNIQUE(`employeeId`)
);
--> statement-breakpoint
CREATE TABLE `leaves` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`leaveType` varchar(50) NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`reason` text,
	`status` enum('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
	`approvedBy` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leaves_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payroll` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`month` varchar(7) NOT NULL,
	`basicSalary` decimal(10,2) NOT NULL,
	`allowances` decimal(10,2) NOT NULL DEFAULT '0.00',
	`deductions` decimal(10,2) NOT NULL DEFAULT '0.00',
	`netSalary` decimal(10,2) NOT NULL,
	`status` enum('Draft','Processed','Paid') NOT NULL DEFAULT 'Draft',
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payroll_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recruitment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`candidateName` varchar(200) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(20),
	`position` varchar(100) NOT NULL,
	`status` enum('Applied','Screening','Interview','Offer','Hired','Rejected') NOT NULL DEFAULT 'Applied',
	`appliedDate` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recruitment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`isSystemRole` boolean NOT NULL DEFAULT false,
	`permissions` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `timesheets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`date` timestamp NOT NULL,
	`projectName` varchar(200),
	`hoursWorked` decimal(5,2) NOT NULL,
	`description` text,
	`status` enum('Draft','Submitted','Approved','Rejected') NOT NULL DEFAULT 'Draft',
	`approvedBy` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `timesheets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userRoles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`roleId` int NOT NULL,
	`effectiveDate` timestamp,
	`assignedBy` varchar(200) NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userRoles_id` PRIMARY KEY(`id`)
);
