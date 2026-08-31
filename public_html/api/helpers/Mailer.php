<?php
declare(strict_types=1);

/**
 * Minimal config-driven SMTP mailer. Sends HTML email via SMTP when SMTP_HOST is
 * configured; otherwise no-ops (logs) so the app runs fine without email creds.
 * Supports STARTTLS (587) and implicit TLS (465) with AUTH LOGIN.
 */
class Mailer
{
    public static function enabled(): bool
    {
        return defined('MAIL_ENABLED') && MAIL_ENABLED;
    }

    public static function send(string $to, string $subject, string $html): bool
    {
        if (!self::enabled()) {
            error_log("[Mailer] SMTP not configured — skipped '$subject' -> $to");
            return false;
        }
        try {
            return self::smtp($to, $subject, $html);
        } catch (\Throwable $e) {
            error_log('[Mailer] send failed: ' . $e->getMessage());
            return false;
        }
    }

    private static function smtp(string $to, string $subject, string $html): bool
    {
        $host = SMTP_HOST; $port = SMTP_PORT;
        $user = SMTP_USER; $pass = SMTP_PASS;
        $from = SMTP_FROM ?: $user; $fromName = SMTP_FROM_NAME;

        $remote = ($port === 465 ? 'ssl://' : '') . $host . ':' . $port;
        $fp = @stream_socket_client($remote, $errno, $errstr, 15);
        if (!$fp) throw new \RuntimeException("connect $remote: $errstr ($errno)");
        stream_set_timeout($fp, 15);

        $read = function () use ($fp): string {
            $data = '';
            while (($line = fgets($fp, 515)) !== false) {
                $data .= $line;
                if (isset($line[3]) && $line[3] === ' ') break;
            }
            return $data;
        };
        $cmd = function (string $c) use ($fp, $read): string { fwrite($fp, $c . "\r\n"); return $read(); };
        $expect = function (string $resp, string $code, string $stage): void {
            if (strpos($resp, $code) !== 0 && strncmp($resp, $code, 3) !== 0) {
                throw new \RuntimeException("SMTP $stage: $resp");
            }
        };

        $read(); // server greeting
        $cmd('EHLO kynetropo');
        if ($port === 587) {
            $cmd('STARTTLS');
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new \RuntimeException('STARTTLS failed');
            }
            $cmd('EHLO kynetropo');
        }
        if ($user !== '') {
            $cmd('AUTH LOGIN');
            $cmd(base64_encode($user));
            $r = $cmd(base64_encode($pass));
            $expect($r, '235', 'auth');
        }
        $cmd("MAIL FROM:<$from>");
        $cmd("RCPT TO:<$to>");
        $cmd('DATA');
        $headers = "From: $fromName <$from>\r\n"
                 . "To: <$to>\r\n"
                 . 'Subject: ' . $subject . "\r\n"
                 . "MIME-Version: 1.0\r\n"
                 . "Content-Type: text/html; charset=UTF-8\r\n";
        $r = $cmd($headers . "\r\n" . $html . "\r\n.");
        $cmd('QUIT');
        fclose($fp);
        return strncmp($r, '250', 3) === 0;
    }

    /** Wrap content in a simple branded HTML shell. */
    public static function layout(string $title, string $bodyHtml): string
    {
        $year = date('Y');
        return "<!DOCTYPE html><html><body style=\"font-family:Arial,sans-serif;background:#f6f7f9;margin:0;padding:24px\">"
            . "<div style=\"max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee\">"
            . "<div style=\"background:#0f766e;color:#fff;padding:20px 24px;font-size:18px;font-weight:bold\">Kynetropo</div>"
            . "<div style=\"padding:24px;color:#333;line-height:1.6\"><h2 style=\"margin-top:0\">$title</h2>$bodyHtml</div>"
            . "<div style=\"padding:16px 24px;color:#999;font-size:12px;border-top:1px solid #eee\">© $year Kynetropo</div>"
            . "</div></body></html>";
    }
}
