-- Krish Agencies: tickets table
-- Run AFTER create_machines.sql and create_employees.sql

CREATE TABLE IF NOT EXISTS `tickets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `ticket_number` varchar(20) NOT NULL,
  `machine_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `assigned_employee_id` int(11) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `priority` varchar(20) NOT NULL DEFAULT 'medium',
  `status` varchar(20) NOT NULL DEFAULT 'open',
  `raised_by` varchar(20) NOT NULL DEFAULT 'customer',
  `work_notes` text DEFAULT NULL,
  `resolution_notes` text DEFAULT NULL,
  `assigned_at` datetime DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ticket_number_tenant` (`tenant_id`, `ticket_number`),
  KEY `idx_tickets_tenant` (`tenant_id`),
  KEY `idx_tickets_machine` (`machine_id`),
  KEY `idx_tickets_customer` (`customer_id`),
  KEY `idx_tickets_employee` (`assigned_employee_id`),
  KEY `idx_tickets_status` (`status`),
  CONSTRAINT `fk_tickets_machine` FOREIGN KEY (`machine_id`) REFERENCES `machines` (`id`),
  CONSTRAINT `fk_tickets_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `fk_tickets_employee` FOREIGN KEY (`assigned_employee_id`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
