-- Krish Agencies: attendance_logs table
-- Run AFTER create_employees.sql

CREATE TABLE IF NOT EXISTS `attendance_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `employee_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `check_in_time` datetime DEFAULT NULL,
  `check_in_lat` decimal(10,7) DEFAULT NULL,
  `check_in_lng` decimal(10,7) DEFAULT NULL,
  `check_out_time` datetime DEFAULT NULL,
  `check_out_lat` decimal(10,7) DEFAULT NULL,
  `check_out_lng` decimal(10,7) DEFAULT NULL,
  `location_name` varchar(150) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'present',
  `hours_worked` decimal(5,2) DEFAULT NULL,
  `method` varchar(20) NOT NULL DEFAULT 'manual',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attendance_emp_date` (`tenant_id`, `employee_id`, `date`),
  KEY `idx_attendance_tenant` (`tenant_id`),
  KEY `idx_attendance_employee` (`employee_id`),
  KEY `idx_attendance_date` (`date`),
  CONSTRAINT `fk_attendance_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
