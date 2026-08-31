-- ============================================================
-- KYNETROPO OPS — COMPLETE SETUP SQL
-- Run this ONE file in phpMyAdmin to set up everything.
-- Import order is correct — no dependency errors.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- ============================================================
-- AUTH TABLES (users + sessions)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id     INT UNSIGNED NOT NULL DEFAULT 1,
  name          VARCHAR(200) NOT NULL DEFAULT '',
  email         VARCHAR(200) NOT NULL,
  phone         VARCHAR(30)  NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL DEFAULT '',
  user_type     VARCHAR(30)  NOT NULL DEFAULT 'admin',
  status        VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email_tenant (email, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  token      VARCHAR(512) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_token (token(64)),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default admin user (password: Admin@2026)
INSERT IGNORE INTO users (id, tenant_id, name, email, phone, password_hash, user_type, status)
VALUES (1, 1, 'Kaushik', 'admin@kynetropo.com', '9876543210',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uFutgzYA.', 'admin', 'active');

-- ============================================================
-- OPS CLIENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS ops_clients (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id         INT UNSIGNED NOT NULL DEFAULT 1,
  name              VARCHAR(200) NOT NULL,
  phone             VARCHAR(30)  NOT NULL DEFAULT '',
  email             VARCHAR(200) NOT NULL DEFAULT '',
  source            VARCHAR(200) NOT NULL DEFAULT '',
  source_pitch_id   INT UNSIGNED DEFAULT NULL,
  owner             VARCHAR(100) NOT NULL DEFAULT '',
  health            ENUM('green','yellow','red') NOT NULL DEFAULT 'green',
  stage             VARCHAR(80)  NOT NULL DEFAULT 'First Meetup',
  notes             TEXT,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ops_clients (id, tenant_id, name, phone, email, source, owner, health, stage, notes, created_at) VALUES
(1,  1, 'EcoSudar',             '9876543210', 'ecosudar@example.com',     'Relative',                              'Kaushik', 'red',    'Bug Fixing',       'Biomass ERP — Fully paid. High reputation risk.',                        '2026-06-08'),
(2,  1, 'AgroPowerPellet',      '9123456780', 'agro@example.com',         'Relative''s friend',                   'Naresh',  'green',  'Full Payment',      'Website + CMS. Quick support item.',                                     '2026-04-27'),
(3,  1, 'VB Solar',             '9123456781', 'vbsolar@example.com',      'YES Meet Kanchipuram',                  'Karthik', 'yellow', 'QA',               'Solar ERP. Fully paid. Internal QA pending.',                            '2026-07-05'),
(4,  1, 'Annai Enterprise',     '9123456782', 'annai@example.com',        'YES Meet Kanchipuram',                  'Kaushik', 'red',    'Bug Fixing',       'Dropshipping Invoice ERP. Balance due ₹12,500.',                         '2026-07-01'),
(5,  1, 'Srivari Scales',       '9123456783', 'srivari@example.com',      'YES Meet Kanchipuram',                  'Karthik', 'yellow', 'Development',      'Inventory ERP. 80% dev complete. Balance due ₹12,500.',                  '2026-07-10'),
(6,  1, 'SS Real Estate',       '9123456784', 'ssrealestate@example.com', 'YES Meet Kanchipuram',                  'Kaushik', 'red',    'Bug Fixing',       'Real Estate CRM. Balance due ₹12,500. Scope not clarified.',             '2026-07-04'),
(7,  1, 'VTT Gold / Thaga Balan','9123456785','vttgold@example.com',      'YES Meet Bangalore',                    'Kaushik', 'yellow', 'Development',      'Gold ERP Phase 1 shown. Not yet quoted.',                                '2026-07-24'),
(8,  1, 'MP TV',                '9123456786', 'mptv@example.com',         'YES Kanchipuram / Gokul referral',      'Kaushik', 'yellow', 'First Meetup',     'Cable TV CRM. Lead. Requirements not done.',                             '2026-07-02'),
(9,  1, 'Gokul Tours',          '9123456787', 'gokul@example.com',        'YES Kanchipuram president',             'Kaushik', 'green',  'First Meetup',     'Tours & Travels CRM. Warm lead. Not onboarded.',                        '2026-08-04'),
(10, 1, 'GE',                   '9123456788', 'ge@example.com',           'Relative referral / subcontract',       'Kaushik', 'yellow', 'Onboarding',       'Foreign client. Scope not yet confirmed.',                               '2026-08-04'),
(11, 1, 'BrickMe Constructions', '9123456789','brickme@example.com',      'YES Meet Bangalore',                    'Kaushik', 'yellow', 'Requirements',     'Construction App. Budget ₹10K, asking ₹16K.',                           '2026-07-22'),
(12, 1, 'Krish Agencies',       '9000011111', 'krish@example.com',        'YES Meet Bangalore',                    'Kaushik', 'green',  'First Meetup',     'Vending Machine ERP. Demo sent. Keep warm.',                             '2026-07-21'),
(13, 1, 'VaramBlessing',        '9000022222', 'varam@example.com',        'YES Meet Bangalore',                    'Kaushik', 'green',  'Requirements',     'Personal Health ERP. Meeting at Kengeri. Quote ₹40K.',                   '2026-07-21'),
(14, 1, 'Data Corp',            '9000033333', 'datacorp@example.com',     'YES Meet Bangalore',                    'Kaushik', 'green',  'First Meetup',     'Traffic Analysis ERP. Demo sent. Discovery pending.',                    '2026-07-21'),
(15, 1, 'Faizal',               '9000044444', 'faizal@example.com',       'Direct / existing relationship',        'Kaushik', 'red',    'Bug Fixing',       'Apartment ERP. Balance ₹14K. Needs boundaries.',                        '2026-06-08');

-- ============================================================
-- OPS PROJECTS
-- ============================================================

CREATE TABLE IF NOT EXISTS ops_projects (
  id                        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id                 INT UNSIGNED NOT NULL DEFAULT 1,
  client_id                 INT UNSIGNED NOT NULL,
  name                      VARCHAR(200) NOT NULL,
  stage                     VARCHAR(80)  NOT NULL DEFAULT 'Lead',
  owner                     VARCHAR(100) NOT NULL DEFAULT '',
  start_date                DATE DEFAULT NULL,
  deadline                  DATE DEFAULT NULL,
  health                    ENUM('green','yellow','red') NOT NULL DEFAULT 'green',
  priority                  ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  quoted                    DECIMAL(12,2) NOT NULL DEFAULT 0,
  received                  DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance                   DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_status            ENUM('pending','partial','paid','overdue') NOT NULL DEFAULT 'pending',
  next_collection_trigger   VARCHAR(200) DEFAULT NULL,
  collection_target_date    DATE DEFAULT NULL,
  current_work              TEXT,
  next_action               TEXT,
  next_deadline             DATE DEFAULT NULL,
  founder_note              TEXT,
  blocker                   TEXT,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ops_projects (id, tenant_id, client_id, name, stage, owner, start_date, deadline, health, priority, quoted, received, balance, payment_status, next_collection_trigger, collection_target_date, current_work, next_action, next_deadline, founder_note, blocker) VALUES
(1,  1, 1,  'Biomass ERP Full',          'Bug Fixing',   'Kaushik / Karthik / Naresh', '2026-06-08', '2026-07-01', 'red',    'critical', 25000, 25000,  0,     'paid',    NULL,                              NULL,           'Reopened for full bug verification; several modules reported missing. Needs complete audit before further client delivery.', 'Freeze new changes; run full module-by-module audit and create master bug/missing-module list.', '2026-08-05', 'High reputation risk. Do not patch randomly; first create one consolidated defect/scope list.', NULL),
(2,  1, 2,  'Website + CMS',             'Full Payment', 'Naresh',                     '2026-04-27', '2026-05-02', 'green',  'low',      6000,  6000,   0,     'paid',    NULL,                              NULL,           'Lander page delivered and paid. Client reopened only for picture change.', 'Collect exact replacement image, update, verify responsive view, close request.', '2026-08-05', NULL, NULL),
(3,  1, 3,  'Solar ERP',                 'Internal QA',  'Karthik / Naresh',           '2026-07-05', '2026-07-17', 'yellow', 'high',     25000, 25000,  0,     'paid',    NULL,                              NULL,           'Development complete. Internal testing pending; then client delivery/UAT.', 'Start structured regression today; fix critical issues before giving client access.', '2026-08-05', 'Do not send untested build. This can become a clean delivery if QA is finished first.', NULL),
(4,  1, 4,  'Dropshipping Invoice ERP',  'Bug Fixing',   'Kaushik',                    '2026-07-01', '2026-07-20', 'red',    'critical', 25000, 12500,  12500, 'partial', 'Stable UAT / agreed bug closure', '2026-08-12',   'Delivered and employees trained. Client continues finding bugs; satisfaction is low.', 'Collect all remaining issues into one list, classify bug vs change, fix P0/P1 first and give one stable release.', '2026-08-05', 'Stabilize before asking for more referrals. After stable UAT, collect balance.', NULL),
(5,  1, 5,  'Inventory ERP',             'Development',  'Karthik',                    '2026-07-10', '2026-08-13', 'yellow', 'high',     25000, 12500,  12500, 'partial', 'Client UAT / delivery',           '2026-08-14',   'Development ~80% complete. Testing and delivery still pending.', 'Finish remaining 20%; feature freeze; hand build to testers.', '2026-08-07', 'Avoid adding new scope until current build is QA passed.', NULL),
(6,  1, 6,  'Real Estate CRM',           'Bug Fixing',   'Kaushik / Naresh',           '2026-07-04', '2026-07-25', 'red',    'critical', 25000, 12500,  12500, 'partial', 'Stable UAT / agreed bug closure', '2026-08-12',   'Delivered; employees trained 20 Jul. Heavy bug fixing plus one flow change being done free because scope was not clarified.', 'Freeze the new flow today, list all open defects, finish critical workflow fixes and regression.', '2026-08-05', 'No further free flow changes after this one; get written acceptance of revised flow.', 'Revised flow not yet frozen'),
(7,  1, 7,  'Gold ERP',                  'Development',  'Kaushik / Karthik / Naresh', '2026-07-24', '2026-08-15', 'yellow', 'high',     0,     0,      0,     'pending', 'Quote before Phase 2 expands',    NULL,           'Phase 1 shown 1 Aug. Requested dashboard gold reminder, 3 payment types, comments; AI agent agreed for last. Promised update slipped.', 'Send Phase 1 update Loom with completed changes; explicitly park AI agent for final phase; confirm Phase 2 requirements.', '2026-08-04', 'Send something today because 3 Aug commitment slipped. Quote before Phase 2 expands.', NULL),
(8,  1, 8,  'Cable TV CRM',              'Lead',         'Kaushik',                    '2026-07-02', NULL,         'yellow', 'medium',   0,     0,      0,     'pending', NULL,                              NULL,           'Client lead exists but requirements/onboarding not completed.', 'Follow up today; schedule 30-minute requirement call and decide fit before committing delivery.', '2026-08-04', 'Do not start coding before scope + quote + advance.', NULL),
(9,  1, 9,  'Tours & Travels CRM',       'Lead',         'Kaushik',                    NULL,         '2026-08-14', 'green',  'low',      0,     0,      0,     'pending', NULL,                              NULL,           'Upcoming lead; not onboarded yet.', 'Schedule discovery only after urgent production bugs are under control.', '2026-08-11', 'Warm lead, but protect current deliveries first.', NULL),
(10, 1, 10, 'Foreign Client Project',    'Onboarding',   'Kaushik / Naresh',           '2026-08-04', '2026-08-08', 'yellow', 'high',     0,     0,      0,     'pending', NULL,                              NULL,           'Expected to start 4 Aug; exact scope/commercials not captured in tracker yet.', 'Get written scope, deliverables, owner, timeline, communication channel and payment terms before development.', '2026-08-05', 'Potentially valuable client; do not begin with ambiguous scope.', 'Scope not confirmed'),
(11, 1, 11, 'Construction App',          'Requirements', 'Kaushik / Naresh',           '2026-07-22', '2026-08-07', 'yellow', 'medium',   16000, 0,      16000, 'pending', '50% advance before coding',       '2026-08-07',   'Requirements received 3 Aug. Client budget ₹10K; you are considering ₹16K while ERP work is normally ₹25K+.', 'Review requirements and send a tightly scoped ₹16K proposal; exclude extras and set change-request pricing.', '2026-08-05', 'Only accept at ₹16K if scope is genuinely small/reusable. Take advance before coding.', NULL),
(12, 1, 12, 'Vending Machine ERP',       'Lead',         'Kaushik',                    '2026-07-21', '2026-08-12', 'green',  'medium',   0,     0,      0,     'pending', NULL,                              NULL,           'Demo ERP sent. Follow-up intentionally delayed because current delivery quality is under pressure.', 'Send a light follow-up and book discovery for next week; do not promise immediate development.', '2026-08-07', 'Keep lead warm while protecting reputation and capacity.', NULL),
(13, 1, 13, 'Personal Health ERP',       'Requirements', 'Kaushik',                    '2026-07-21', '2026-08-06', 'green',  'high',     40000, 0,      40000, 'pending', '50% advance after proposal acceptance', '2026-08-07', 'Demo ERP sent 27 Jul. Meeting requested at Kengeri on 4 Aug. Thinking of ₹40K quote.', 'Attend meeting; gather workflow and must-have modules; do not finalize scope verbally. Send written ₹40K+ proposal after meeting.', '2026-08-04', 'Strong lead. Use requirement document and 50% advance before build.', NULL),
(14, 1, 14, 'Traffic Analysis ERP',      'Lead',         'Kaushik',                    '2026-07-21', '2026-08-07', 'green',  'medium',   0,     0,      0,     'pending', NULL,                              NULL,           'Demo sent 27 Jul; client said they were on long weekend and would return this week.', 'Follow up after the holiday; ask for 30-minute discovery slot rather than another generic demo.', '2026-08-05', 'Qualify technical/data requirements before quoting.', NULL),
(15, 1, 15, 'Apartment ERP',             'Bug Fixing',   'Kaushik / Naresh',           '2026-06-08', '2026-08-12', 'red',    'critical', 20000, 6000,   14000, 'partial', 'Stable UAT / agreed bug closure', '2026-08-12',   'Long-running exhausting client; ₹6K paid, ₹14K balance. Client continues calling with bugs/issues.', 'Stop ad-hoc calls: request one consolidated issue list, separate bugs from new changes, set closure/UAT date and payment milestone.', '2026-08-05', 'Needs boundaries immediately. No unlimited new changes under old amount.', NULL);

-- ============================================================
-- OPS PROJECT STAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS ops_project_stages (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  project_id   INT UNSIGNED NOT NULL,
  stage_name   VARCHAR(80)  NOT NULL,
  completed_by VARCHAR(100) NOT NULL DEFAULT '',
  completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes        TEXT,
  INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- OPS ACTIVITY LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS ops_activity_log (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  entity_type VARCHAR(50)  NOT NULL,
  entity_id   INT UNSIGNED NOT NULL,
  action      VARCHAR(100) NOT NULL,
  description TEXT,
  done_by     VARCHAR(100) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ops_activity_comments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  activity_id INT UNSIGNED NOT NULL,
  comment     TEXT NOT NULL,
  added_by    VARCHAR(100) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activity (activity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed activity for key clients
INSERT INTO ops_activity_log (tenant_id, entity_type, entity_id, action, description, done_by, created_at) VALUES
(1,'client',1,'created','Client created','Kaushik','2026-06-08 09:00:00'),
(1,'client',1,'stage_changed','Stage advanced to Bug Fixing','Kaushik','2026-06-15 10:00:00'),
(1,'client',4,'created','Client created','Kaushik','2026-07-01 09:00:00'),
(1,'client',4,'payment_received','Payment received ₹12,500 on 05 Jul 2026 — advance','Kaushik','2026-07-05 11:00:00'),
(1,'client',6,'created','Client created','Kaushik','2026-07-04 09:00:00'),
(1,'client',6,'payment_received','Payment received ₹12,500 on 06 Jul 2026 — advance','Kaushik','2026-07-06 11:00:00'),
(1,'client',15,'created','Client created','Kaushik','2026-06-08 09:00:00'),
(1,'client',15,'payment_received','Payment received ₹6,000 on 10 Jun 2026 — advance','Kaushik','2026-06-10 11:00:00');

-- ============================================================
-- OPS MEETINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS ops_meetings (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id       INT UNSIGNED NOT NULL DEFAULT 1,
  client_id       INT UNSIGNED DEFAULT NULL,
  project_id      INT UNSIGNED DEFAULT NULL,
  date            DATETIME NOT NULL,
  type            ENUM('google_meet','in_person','phone_call','whatsapp_call') NOT NULL DEFAULT 'google_meet',
  link            VARCHAR(500) DEFAULT NULL,
  attendees       TEXT,
  agenda          TEXT,
  outcome         TEXT,
  next_action     TEXT,
  next_followup   DATE DEFAULT NULL,
  booked_by       VARCHAR(100) NOT NULL DEFAULT '',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_followup (next_followup)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ops_meetings (tenant_id, client_id, project_id, date, type, outcome, next_action, next_followup, booked_by) VALUES
(1, 1,  1,  '2026-07-27 11:00:00', 'google_meet',  'Reviewed bug list. Client frustrated with repeated issues. Agreed to do full audit before next release.', 'Complete module audit and send consolidated list', '2026-08-05', 'Kaushik'),
(1, 4,  4,  '2026-07-22 14:00:00', 'in_person',    'Delivery and employee training done. Several bugs reported. Client satisfaction low.', 'Collect all bugs into one list and fix P0/P1', '2026-08-05', 'Kaushik'),
(1, 6,  6,  '2026-07-20 10:00:00', 'in_person',    'Employee training completed. Client reported CRM workflow issues and requested one flow change.', 'Freeze flow, list defects, fix regression', '2026-08-05', 'Kaushik'),
(1, 7,  7,  '2026-08-01 15:00:00', 'google_meet',  'Phase 1 demonstrated. Client requested gold reminder on dashboard, 3 payment types, comments section.', 'Send Loom update, confirm Phase 2 scope, send quote', '2026-08-07', 'Kaushik'),
(1, 13, 13, '2026-08-04 11:00:00', 'in_person',    NULL, 'Gather requirements, send written ₹40K proposal', '2026-08-05', 'Kaushik');

-- ============================================================
-- OPS BUGS
-- ============================================================

CREATE TABLE IF NOT EXISTS ops_bugs (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id      INT UNSIGNED NOT NULL DEFAULT 1,
  project_id     INT UNSIGNED NOT NULL,
  module         VARCHAR(100) NOT NULL DEFAULT '',
  description    TEXT NOT NULL,
  type           ENUM('bug','feature_request','change_request') NOT NULL DEFAULT 'bug',
  priority       ENUM('p0_critical','p1_high','p2_medium','p3_low') NOT NULL DEFAULT 'p2_medium',
  reported_by    VARCHAR(100) NOT NULL DEFAULT '',
  developer_id   INT UNSIGNED DEFAULT NULL,
  qa_id          INT UNSIGNED DEFAULT NULL,
  status         ENUM('open','in_progress','fixed','retest','closed','wont_fix') NOT NULL DEFAULT 'open',
  target_date    DATE DEFAULT NULL,
  steps_to_repro TEXT,
  parent_bug_id  INT UNSIGNED DEFAULT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ops_bug_screenshots (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  bug_id      INT UNSIGNED NOT NULL,
  file_path   VARCHAR(500) NOT NULL,
  uploaded_by VARCHAR(100) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ops_bug_comments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  bug_id      INT UNSIGNED NOT NULL,
  comment     TEXT NOT NULL,
  added_by    VARCHAR(100) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bugs from QA sheet
INSERT INTO ops_bugs (tenant_id, project_id, module, description, type, priority, reported_by, status, target_date, steps_to_repro) VALUES
(1, 1, 'All modules',     'Full module-by-module audit — identify missing modules and broken workflows', 'bug', 'p0_critical', 'Internal', 'open',        '2026-08-05', 'Run each module end-to-end and document what is missing or broken'),
(1, 3, 'Full ERP',        'Regression testing before client delivery', 'bug', 'p1_high', 'Internal', 'open',        '2026-08-06', 'Test all major workflows end-to-end'),
(1, 4, 'Full ERP',        'Consolidate all client-reported bugs and reproduce each one', 'bug', 'p0_critical', 'Client', 'in_progress', '2026-08-08', '1. Collect all client WhatsApp messages\n2. Reproduce each issue\n3. Separate bug vs change request'),
(1, 6, 'CRM workflow',    'Regression after revised flow and all bug fixes', 'bug', 'p0_critical', 'Client', 'open',        '2026-08-09', '1. Freeze revised flow\n2. Run full CRM workflow end-to-end\n3. Verify all stages work'),
(1, 5, 'Full ERP',        'Functional and workflow QA after remaining 20% development', 'bug', 'p1_high', 'Internal', 'open',        '2026-08-11', 'Feature freeze first, then test all modules'),
(1, 15, 'Full ERP',       'Consolidated issue reproduction and regression', 'bug', 'p0_critical', 'Client', 'open',        '2026-08-10', '1. Get client to send one consolidated list\n2. Reproduce each item\n3. Fix and regression test');

-- ============================================================
-- OPS FINANCE (payments + expenses)
-- ============================================================

CREATE TABLE IF NOT EXISTS ops_payments (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  client_id    INT UNSIGNED NOT NULL,
  project_id   INT UNSIGNED NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  type         ENUM('advance','mid','final','amc','other') NOT NULL DEFAULT 'advance',
  mode         ENUM('cash','bank_transfer','upi','cheque','other') NOT NULL DEFAULT 'bank_transfer',
  reference    VARCHAR(200) DEFAULT NULL,
  recorded_by  VARCHAR(100) NOT NULL DEFAULT '',
  payment_date DATE NOT NULL,
  notes        TEXT,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_client (client_id),
  INDEX idx_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ops_expenses (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  category    ENUM('hosting','tools','travel','marketing','salary','pitch','other') NOT NULL DEFAULT 'other',
  amount      DECIMAL(12,2) NOT NULL,
  description TEXT,
  project_id  INT UNSIGNED DEFAULT NULL,
  pitch_id    INT UNSIGNED DEFAULT NULL,
  date        DATE NOT NULL,
  added_by    VARCHAR(100) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Real payment data from Excel
INSERT INTO ops_payments (tenant_id, client_id, project_id, amount, type, mode, recorded_by, payment_date, notes) VALUES
(1, 1,  1,  25000, 'final',   'bank_transfer', 'Kaushik', '2026-06-20', 'Biomass ERP — full payment'),
(1, 2,  2,  6000,  'final',   'upi',           'Naresh',  '2026-04-30', 'Website + CMS — full payment'),
(1, 3,  3,  25000, 'final',   'upi',           'Karthik', '2026-07-10', 'Solar ERP — full payment'),
(1, 4,  4,  12500, 'advance', 'upi',           'Kaushik', '2026-07-05', 'Dropshipping Invoice ERP — 50% advance'),
(1, 5,  5,  12500, 'advance', 'bank_transfer', 'Karthik', '2026-07-12', 'Inventory ERP — 50% advance'),
(1, 6,  6,  12500, 'advance', 'upi',           'Kaushik', '2026-07-08', 'Real Estate CRM — 50% advance'),
(1, 15, 15, 6000,  'advance', 'cash',          'Kaushik', '2026-06-10', 'Apartment ERP — partial advance');

-- ============================================================
-- OPS AMC RECORDS
-- ============================================================

CREATE TABLE IF NOT EXISTS ops_amc_records (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  client_id    INT UNSIGNED NOT NULL,
  project_id   INT UNSIGNED NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  start_date   DATE NOT NULL,
  renewal_date DATE NOT NULL,
  status       ENUM('active','due','overdue','paid') NOT NULL DEFAULT 'active',
  payment_mode VARCHAR(50) DEFAULT NULL,
  payment_id   INT UNSIGNED DEFAULT NULL,
  notes        TEXT,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_renewal (renewal_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- OPS PITCHES
-- ============================================================

CREATE TABLE IF NOT EXISTS ops_pitches (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  name        VARCHAR(200) NOT NULL,
  date        DATE NOT NULL,
  venue       VARCHAR(200) DEFAULT NULL,
  city        VARCHAR(100) DEFAULT NULL,
  type        ENUM('yes_meeting','business_forum','cold_outreach','referral_event','online','other') NOT NULL DEFAULT 'yes_meeting',
  spend       DECIMAL(12,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_by  VARCHAR(100) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ops_pitches (id, tenant_id, name, date, venue, city, type, spend, description, created_by) VALUES
(1, 1, 'YES Meet Kanchipuram', '2026-06-15', 'YES Meeting Hall', 'Kanchipuram', 'yes_meeting', 2000, 'Generated leads: EcoSudar (Biomass), AgroPowerPellet, VB Solar, Annai Enterprise, Srivari Scales, SS Real Estate, MP TV, Gokul Tours. Strong batch.', 'Kaushik'),
(2, 1, 'YES Meet Bangalore',   '2026-07-21', 'YES Meeting Hall', 'Bangalore',   'yes_meeting', 3500, 'Generated leads: VTT Gold, BrickMe Constructions, Krish Agencies, VaramBlessing, Data Corp. 5 new leads from one event.', 'Kaushik');

-- Update client source_pitch_id
UPDATE ops_clients SET source_pitch_id = 1 WHERE id IN (1,2,3,4,5,6,8,9);
UPDATE ops_clients SET source_pitch_id = 2 WHERE id IN (7,11,12,13,14);

-- Pitch expenses
INSERT INTO ops_expenses (tenant_id, category, amount, description, pitch_id, date, added_by) VALUES
(1, 'pitch', 2000, 'YES Meet Kanchipuram — travel + registration', 1, '2026-06-15', 'Kaushik'),
(1, 'pitch', 3500, 'YES Meet Bangalore — travel + registration',   2, '2026-07-21', 'Kaushik');

-- ============================================================
-- OPS DOCUMENT CHECKLIST
-- ============================================================

CREATE TABLE IF NOT EXISTS ops_document_checklist (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id      INT UNSIGNED NOT NULL DEFAULT 1,
  client_id      INT UNSIGNED NOT NULL,
  item_name      VARCHAR(200) NOT NULL,
  is_done        TINYINT(1) NOT NULL DEFAULT 0,
  completed_date DATE DEFAULT NULL,
  file_path      VARCHAR(500) DEFAULT NULL,
  completed_by   VARCHAR(100) DEFAULT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- OPS EMPLOYEES
-- ============================================================

CREATE TABLE IF NOT EXISTS ops_employees (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  name         VARCHAR(200) NOT NULL,
  phone        VARCHAR(30)  NOT NULL DEFAULT '',
  email        VARCHAR(200) NOT NULL DEFAULT '',
  role         ENUM('founder','qa_tester','sales_caller','trainer','developer','other') NOT NULL DEFAULT 'other',
  access_level ENUM('full','bugs_only','clients_readonly','clients_followups') NOT NULL DEFAULT 'clients_readonly',
  monthly_pay  DECIMAL(10,2) NOT NULL DEFAULT 0,
  start_date   DATE DEFAULT NULL,
  status       ENUM('active','inactive') NOT NULL DEFAULT 'active',
  notes        TEXT,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ops_employees (tenant_id, name, phone, email, role, access_level, monthly_pay, start_date, status, notes) VALUES
(1, 'Kaushik', '9876543210', 'kaushik@kynetropo.com', 'founder',   'full',      0,    '2025-01-01', 'active', 'Founder — full access'),
(1, 'Karthik', '9876543211', 'karthik@kynetropo.com', 'developer', 'full',      15000,'2025-06-01', 'active', 'Senior developer'),
(1, 'Naresh',  '9876543212', 'naresh@kynetropo.com',  'developer', 'full',      12000,'2025-08-01', 'active', 'Developer');

-- ============================================================
-- OPS HIRING CANDIDATES
-- ============================================================

CREATE TABLE IF NOT EXISTS ops_hiring_candidates (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id          INT UNSIGNED NOT NULL DEFAULT 1,
  name               VARCHAR(200) NOT NULL,
  email              VARCHAR(200) DEFAULT NULL,
  phone              VARCHAR(30)  DEFAULT NULL,
  assignment_sent    DATE DEFAULT NULL,
  assignment_due     DATE DEFAULT NULL,
  submitted          TINYINT(1) NOT NULL DEFAULT 0,
  workflow_bugs      INT UNSIGNED NOT NULL DEFAULT 0,
  critical_bugs      INT UNSIGNED NOT NULL DEFAULT 0,
  reporting_quality  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  reasoning_quality  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  score              DECIMAL(4,1) NOT NULL DEFAULT 0,
  decision           ENUM('pending','selected','rejected') NOT NULL DEFAULT 'pending',
  rejection_reason   TEXT,
  start_date         DATE DEFAULT NULL,
  notes              TEXT,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8 candidates from hiring sheet (LinkedIn batch)
INSERT INTO ops_hiring_candidates (tenant_id, name, assignment_sent, assignment_due, decision, notes) VALUES
(1, 'Candidate 1', '2026-08-03', '2026-08-05', 'pending', 'LinkedIn — part-time QA tester applicant'),
(1, 'Candidate 2', '2026-08-03', '2026-08-05', 'pending', 'LinkedIn — part-time QA tester applicant'),
(1, 'Candidate 3', '2026-08-03', '2026-08-05', 'pending', 'LinkedIn — part-time QA tester applicant'),
(1, 'Candidate 4', '2026-08-03', '2026-08-05', 'pending', 'LinkedIn — part-time QA tester applicant'),
(1, 'Candidate 5', '2026-08-03', '2026-08-05', 'pending', 'LinkedIn — part-time QA tester applicant'),
(1, 'Candidate 6', '2026-08-03', '2026-08-05', 'pending', 'LinkedIn — part-time QA tester applicant'),
(1, 'Candidate 7', '2026-08-03', '2026-08-05', 'pending', 'LinkedIn — part-time QA tester applicant'),
(1, 'Candidate 8', '2026-08-03', '2026-08-05', 'pending', 'LinkedIn — part-time QA tester applicant');

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- DONE — all 15 clients, 15 projects, 6 bugs, 7 payments,
-- 2 pitches, 5 meetings, 3 employees, 8 candidates loaded.
-- ============================================================
