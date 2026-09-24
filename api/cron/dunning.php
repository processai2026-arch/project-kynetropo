<?php
declare(strict_types=1);
/**
 * Dunning / lifecycle cron (control plane). Run daily, e.g.:
 *   docker compose exec -T api php cron/dunning.php
 *
 * 1. Trials past trial_ends_at        → subscription 'expired', tenant 'past_due'.
 * 2. Active subs past current_end     → subscription 'past_due', tenant 'past_due'.
 * 3. past_due longer than grace       → tenant 'suspended'.
 * (assertActive() already blocks trialing-expired / past_due / suspended at request
 *  time; this just advances the persisted lifecycle so dashboards & gating reflect it.)
 */
define('ROOT_PATH', dirname(__DIR__));
require_once ROOT_PATH . '/config/app.php';
require_once ROOT_PATH . '/core/Response.php';
require_once ROOT_PATH . '/config/database.php';
require_once ROOT_PATH . '/config/tenancy.php';
require_once ROOT_PATH . '/core/PlatformDB.php';

$grace = defined('BILLING_GRACE_DAYS') ? BILLING_GRACE_DAYS : 7;

$expiredTrials = PlatformDB::execute(
    "UPDATE subscriptions SET status='expired', updated_at=NOW()
     WHERE status='trialing' AND trial_ends_at IS NOT NULL AND trial_ends_at < NOW()"
);
PlatformDB::execute(
    "UPDATE tenants t JOIN subscriptions s ON s.tenant_id=t.tenant_id
     SET t.status='past_due', t.updated_at=NOW()
     WHERE s.status='expired' AND t.status='trialing'"
);

$renewalsDue = PlatformDB::execute(
    "UPDATE subscriptions SET status='past_due', updated_at=NOW()
     WHERE status='active' AND current_end IS NOT NULL AND current_end < NOW()"
);
PlatformDB::execute(
    "UPDATE tenants t JOIN subscriptions s ON s.tenant_id=t.tenant_id
     SET t.status='past_due', t.updated_at=NOW()
     WHERE s.status='past_due' AND t.status='active'"
);

$suspended = PlatformDB::execute(
    "UPDATE tenants SET status='suspended', updated_at=NOW()
     WHERE status='past_due' AND updated_at < DATE_SUB(NOW(), INTERVAL $grace DAY)"
);

fwrite(STDOUT, sprintf(
    "[dunning] trials_expired=%d renewals_due=%d suspended=%d (grace=%dd)\n",
    $expiredTrials, $renewalsDue, $suspended, $grace
));
