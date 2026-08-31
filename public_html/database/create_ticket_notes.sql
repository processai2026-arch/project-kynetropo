-- Krish Agencies: ticket_notes (activity log)
-- Run AFTER create_tickets.sql

CREATE TABLE IF NOT EXISTS `ticket_notes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `ticket_id` int(11) NOT NULL,
  `author_name` varchar(100) NOT NULL,
  `author_role` enum('admin','customer','employee') NOT NULL DEFAULT 'admin',
  `note` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ticket_notes_ticket` (`ticket_id`),
  KEY `idx_ticket_notes_tenant` (`tenant_id`),
  CONSTRAINT `fk_ticket_notes_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
