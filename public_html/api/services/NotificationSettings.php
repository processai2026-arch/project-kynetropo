<?php
declare(strict_types=1);

/**
 * NotificationSettings — tenant-scoped helper for checking notification dispatch toggles
 *
 * Maps notification types to their storage keys and provides a gate function.
 * Each notification type corresponds to a setting that controls whether that
 * type of email/alert is actually dispatched.
 */
class NotificationSettings
{
    /** Map notification type → settings database key */
    private const TYPE_KEY_MAP = [
        'order_alerts'      => 'notify_order',        // send emails when new orders arrive
        'low_stock'         => 'notify_low_stock',    // send alerts when stock falls below threshold
        'new_customer'      => 'notify_new_customer', // send notifications for new customers
    ];

    /**
     * Check whether a notification type is enabled for the current tenant.
     *
     * @param string $type notification type (e.g., 'order_alerts', 'low_stock', 'new_customer')
     * @return bool true if enabled (email should be sent); false if disabled
     */
    public static function enabled(string $type): bool
    {
        $key = self::TYPE_KEY_MAP[$type] ?? null;
        if ($key === null) {
            // Unknown type defaults to false (don't send)
            error_log("[NotificationSettings] Unknown notification type: $type");
            return false;
        }

        $tenantId = Database::tenantId();
        $value = Database::fetch(
            'SELECT setting_value FROM settings WHERE tenant_id = ? AND setting_key = ? LIMIT 1',
            [$tenantId, $key]
        );

        if (!$value) {
            // Missing setting defaults to true (send, as per legacy behavior)
            return true;
        }

        return (bool)(int)$value['setting_value'];
    }

    /**
     * Get the database key for a notification type.
     *
     * @param string $type notification type
     * @return string|null the settings key, or null if type is unknown
     */
    public static function keyFor(string $type): ?string
    {
        return self::TYPE_KEY_MAP[$type] ?? null;
    }
}
