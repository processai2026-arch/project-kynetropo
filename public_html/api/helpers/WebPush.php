<?php
declare(strict_types=1);

/**
 * Web Push, without a library.
 *
 * In-app alerts only exist while the app is open — the tab polls, and a phone
 * with the app closed hears nothing. A push notification is delivered by the
 * browser's own push service, so a task assigned to somebody at 9pm reaches
 * them at 9pm whether or not they have Kynetropo on screen.
 *
 * Two pieces of cryptography are involved, both done here with the openssl
 * extension because there is no composer on this host:
 *
 *   VAPID   — an ES256 JWT proving to the push service which application server
 *             is sending. Signed with a P-256 key kept in .env.
 *   aes128gcm — the payload, encrypted end-to-end for the subscriber's own key
 *             pair (RFC 8291). The push service relays bytes it cannot read.
 *
 * Nothing here throws on failure: a notification that cannot be delivered must
 * never take down the request that triggered it. Failures are returned so the
 * caller can drop subscriptions the push service has retired.
 */
final class WebPush
{
    /** Push services reject anything much larger; ours are one line of text. */
    private const MAX_PAYLOAD = 3800;

    /** How long the VAPID assertion is good for. Twelve hours is well inside the 24 allowed. */
    private const JWT_TTL = 43200;

    public static function configured(): bool
    {
        return self::publicKey() !== '' && self::privateKey() !== '';
    }

    /** @var array<string,string>|null Parsed once per request. */
    private static ?array $env = null;

    /**
     * One value out of .env.
     *
     * Read here rather than through a config class because there is not one —
     * app.php pulls each secret out of .env inline, and the keys must stay in
     * that file: they are what proves this server sent the notification, and a
     * committed VAPID key lets anyone push to our users.
     */
    private static function env(string $key): string
    {
        if (self::$env === null) {
            self::$env = [];
            $path = dirname(__DIR__, 2) . '/.env';
            if (is_file($path)) {
                foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                    if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) {
                        continue;
                    }
                    [$k, $v] = array_map('trim', explode('=', $line, 2));
                    self::$env[$k] = trim($v, "\"'");
                }
            }
        }
        return self::$env[$key] ?? '';
    }

    public static function publicKey(): string
    {
        return self::env('VAPID_PUBLIC_KEY');
    }

    private static function privateKey(): string
    {
        return self::env('VAPID_PRIVATE_KEY');
    }

    private static function subject(): string
    {
        $s = self::env('VAPID_SUBJECT');
        return $s !== '' ? $s : 'https://project.kynetropo.com';
    }

    // ── Sending ─────────────────────────────────────────────────────────────

    /**
     * Delivers one notification to one subscription.
     *
     * @param array $sub  endpoint, p256dh, auth — as stored from the browser
     * @param array $data the notification body; whatever the service worker reads
     * @return array{ok:bool, status:int, gone:bool, error:string}
     */
    public static function send(array $sub, array $data): array
    {
        $fail = static fn(string $why): array => ['ok' => false, 'status' => 0, 'gone' => false, 'error' => $why];

        if (!self::configured()) {
            return $fail('VAPID keys are not configured');
        }
        $endpoint = (string)($sub['endpoint'] ?? '');
        if ($endpoint === '' || !preg_match('#^https://#', $endpoint)) {
            return $fail('Bad endpoint');
        }

        $payload = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($payload === false || strlen($payload) > self::MAX_PAYLOAD) {
            return $fail('Payload too large');
        }

        $body = self::encrypt($payload, (string)($sub['p256dh'] ?? ''), (string)($sub['auth'] ?? ''));
        if ($body === null) {
            return $fail('Could not encrypt the payload');
        }

        $jwt = self::vapidToken($endpoint);
        if ($jwt === null) {
            return $fail('Could not sign the VAPID token');
        }

        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/octet-stream',
                'Content-Encoding: aes128gcm',
                'TTL: 86400',
                'Urgency: normal',
                'Authorization: vapid t=' . $jwt . ', k=' . self::publicKey(),
            ],
        ]);
        $response = curl_exec($ch);
        $status   = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        // 404/410 mean the subscription is dead — the browser was reinstalled,
        // or permission was revoked. The caller deletes those rather than
        // retrying them forever.
        $gone = in_array($status, [404, 410], true);

        return [
            'ok'     => $status >= 200 && $status < 300,
            'status' => $status,
            'gone'   => $gone,
            'error'  => $curlErr !== '' ? $curlErr : (string)$response,
        ];
    }

    // ── RFC 8291 payload encryption ─────────────────────────────────────────

    /**
     * Encrypts the payload for one subscriber, in the aes128gcm content coding.
     *
     * The wire format is a header (salt, record size, the ephemeral public key)
     * followed by one AES-128-GCM record. The keys come from an ECDH between a
     * throwaway key pair and the subscriber's, run through HKDF exactly as the
     * RFC prescribes — the constants below are from the spec, not arbitrary.
     */
    private static function encrypt(string $payload, string $p256dhB64, string $authB64): ?string
    {
        $subPublic = self::b64uDecode($p256dhB64);
        $authTag   = self::b64uDecode($authB64);
        if (strlen($subPublic) !== 65 || $subPublic[0] !== "\x04" || strlen($authTag) !== 16) {
            return null;
        }

        // A fresh key pair per message: the ephemeral public key travels in the
        // header, and the private half is thrown away immediately after.
        $local = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        if (!$local) {
            return null;
        }
        $localDetails = openssl_pkey_get_details($local);
        if (!$localDetails || !isset($localDetails['ec']['x'], $localDetails['ec']['y'])) {
            return null;
        }
        $localPublic = "\x04" . str_pad($localDetails['ec']['x'], 32, "\0", STR_PAD_LEFT)
                              . str_pad($localDetails['ec']['y'], 32, "\0", STR_PAD_LEFT);

        $peerPem = self::pemFromPoint($subPublic);
        if ($peerPem === null) {
            return null;
        }
        $shared = @openssl_pkey_derive($peerPem, $local, 32);
        if (!is_string($shared) || $shared === '') {
            return null;
        }

        $salt = random_bytes(16);

        // Step one: mix the ECDH secret with the subscriber's auth secret.
        $prkInfo = "WebPush: info\0" . $subPublic . $localPublic;
        $ikm     = hash_hkdf('sha256', $shared, 32, $prkInfo, $authTag);

        $cek   = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
        $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);

        // A single record, so the padding delimiter is 0x02 ("last record").
        $plaintext = $payload . "\x02";
        $tag       = '';
        $cipher    = openssl_encrypt($plaintext, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
        if ($cipher === false) {
            return null;
        }

        // salt(16) | record size(4) | key length(1) | key(65) | ciphertext+tag
        return $salt
            . pack('N', 4096)
            . pack('C', strlen($localPublic))
            . $localPublic
            . $cipher . $tag;
    }

    /**
     * Wraps a raw uncompressed EC point in the SPKI/PEM that openssl wants.
     *
     * The browser hands us 65 bytes; openssl_pkey_derive needs a key resource.
     * The prefix is the fixed DER for "id-ecPublicKey over prime256v1", so the
     * point can simply be appended.
     */
    private static function pemFromPoint(string $point): ?string
    {
        if (strlen($point) !== 65) {
            return null;
        }
        $der = hex2bin(
            '3059'                              // SEQUENCE, 89 bytes
            . '3013'                            //   SEQUENCE, 19 bytes
            . '06072a8648ce3d0201'              //     OID 1.2.840.10045.2.1 (ecPublicKey)
            . '06082a8648ce3d030107'            //     OID 1.2.840.10045.3.1.7 (prime256v1)
            . '0342' . '00'                     //   BIT STRING, 66 bytes, 0 unused bits
        );
        if ($der === false) {
            return null;
        }
        $pem = "-----BEGIN PUBLIC KEY-----\n"
             . chunk_split(base64_encode($der . $point), 64, "\n")
             . "-----END PUBLIC KEY-----\n";
        return $pem;
    }

    // ── VAPID ───────────────────────────────────────────────────────────────

    /** The ES256 assertion the push service checks before accepting a message. */
    private static function vapidToken(string $endpoint): ?string
    {
        $parts = parse_url($endpoint);
        if (!isset($parts['scheme'], $parts['host'])) {
            return null;
        }
        $audience = $parts['scheme'] . '://' . $parts['host'];

        $header  = self::b64uEncode((string)json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
        $claims  = self::b64uEncode((string)json_encode([
            'aud' => $audience,
            'exp' => time() + self::JWT_TTL,
            'sub' => self::subject(),
        ]));
        $signing = $header . '.' . $claims;

        $key = self::privateKeyResource();
        if ($key === null) {
            return null;
        }

        $der = '';
        if (!openssl_sign($signing, $der, $key, OPENSSL_ALGO_SHA256)) {
            return null;
        }
        $raw = self::derToRaw($der);
        if ($raw === null) {
            return null;
        }

        return $signing . '.' . self::b64uEncode($raw);
    }

    /**
     * Rebuilds the signing key from the 32 raw private bytes in .env.
     *
     * Stored raw rather than as PEM because that is what every VAPID key
     * generator emits, and a PEM in a .env line is a paste waiting to be
     * mangled. The public half is recomputed here rather than trusted.
     */
    private static function privateKeyResource(): mixed
    {
        $d      = self::b64uDecode(self::privateKey());
        $public = self::b64uDecode(self::publicKey());
        if (strlen($d) !== 32 || strlen($public) !== 65) {
            return null;
        }

        // SEC1 EC private key: version, the key, the named curve, the point.
        $der = hex2bin('30770201010420') . $d
             . hex2bin('a00a06082a8648ce3d030107a144034200') . $public;

        $pem = "-----BEGIN EC PRIVATE KEY-----\n"
             . chunk_split(base64_encode($der), 64, "\n")
             . "-----END EC PRIVATE KEY-----\n";

        $key = openssl_pkey_get_private($pem);
        return $key ?: null;
    }

    /**
     * DER ECDSA signature -> the fixed 64-byte R||S that JOSE requires.
     *
     * openssl_sign returns DER, where R and S are variable-length integers that
     * may carry a leading zero byte. Pasting that into a JWT produces a
     * signature every push service rejects.
     */
    private static function derToRaw(string $der): ?string
    {
        $offset = 0;
        if (($der[$offset++] ?? '') !== "\x30") {
            return null;
        }
        $len = ord($der[$offset++] ?? "\0");
        if ($len & 0x80) {
            $offset += ($len & 0x7f);
        }

        $readInt = static function (string $der, int &$offset): ?string {
            if (($der[$offset++] ?? '') !== "\x02") {
                return null;
            }
            $length = ord($der[$offset++] ?? "\0");
            $value  = substr($der, $offset, $length);
            $offset += $length;
            $value = ltrim($value, "\0");
            return str_pad($value, 32, "\0", STR_PAD_LEFT);
        };

        $r = $readInt($der, $offset);
        $s = $readInt($der, $offset);
        if ($r === null || $s === null || strlen($r) !== 32 || strlen($s) !== 32) {
            return null;
        }
        return $r . $s;
    }

    // ── base64url ───────────────────────────────────────────────────────────

    public static function b64uEncode(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    public static function b64uDecode(string $value): string
    {
        $value = strtr(trim($value), '-_', '+/');
        $pad   = strlen($value) % 4;
        if ($pad) {
            $value .= str_repeat('=', 4 - $pad);
        }
        $out = base64_decode($value, true);
        return $out === false ? '' : $out;
    }
}
