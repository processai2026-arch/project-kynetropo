<?php
/**
 * Smoke test for project.kynetropo.com
 *
 * Reads .env, mints a 2-minute admin JWT, hits every list endpoint,
 * tests wrong-password rejection, prints api/error_log lines from the
 * run, and exits non-zero on any failure.
 *
 * Usage (from project root):
 *   php scripts/smoke.php [https://project.kynetropo.com/api]
 *
 * The optional argument overrides the default base URL.
 */

declare(strict_types=1);

// ─── Bootstrap ────────────────────────────────────────────────────────────────

$projectRoot = dirname(__DIR__);
$envFile     = $projectRoot . '/.env';

if (!file_exists($envFile)) {
    fwrite(STDERR, "FATAL: .env not found at $envFile\n");
    exit(1);
}

// Read .env into $env array
$env = [];
foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $line = trim($line);
    if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
    [$k, $v] = array_map('trim', explode('=', $line, 2));
    $env[$k] = trim($v, '"\'');
}

$jwtSecret  = $env['JWT_SECRET']  ?? '';
$dbHost     = $env['DB_HOST']     ?? '127.0.0.1';
$dbPort     = (int)($env['DB_PORT'] ?? 3306);
$dbName     = $env['DB_NAME']     ?? '';
$dbUser     = $env['DB_USER']     ?? '';
$dbPass     = $env['DB_PASS']     ?? '';

if (strlen($jwtSecret) < 32) {
    fwrite(STDERR, "FATAL: JWT_SECRET missing or too short in .env\n");
    exit(1);
}

$baseUrl = $argv[1] ?? ($env['APP_URL'] ?? 'http://localhost/api');
$baseUrl = rtrim($baseUrl, '/');

// ─── JWT helper ───────────────────────────────────────────────────────────────

function b64url(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function mintJwt(int $userId, string $secret, int $ttlSeconds = 120, int $tenantId = 1): string
{
    $now     = time();
    $header  = b64url((string)json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = b64url((string)json_encode([
        'sub'    => $userId,
        'type'   => 'access',
        'client' => 'admin',
        'tid'    => $tenantId,
        'iat'  => $now,
        'nbf'  => $now,
        'exp'  => $now + $ttlSeconds,
        'jti'  => bin2hex(random_bytes(16)),
    ]));
    $sig = b64url(hash_hmac('sha256', "$header.$payload", $secret, true));
    return "$header.$payload.$sig";
}

// ─── Database: look up the first active admin user ────────────────────────────

$dsn = "mysql:host=$dbHost;port=$dbPort;dbname=$dbName;charset=utf8mb4";
try {
    $pdo = new PDO($dsn, $dbUser, $dbPass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (Throwable $e) {
    fwrite(STDERR, "FATAL: cannot connect to database: " . $e->getMessage() . "\n");
    exit(1);
}

$adminRow = $pdo->query(
    "SELECT user_id, tenant_id FROM users WHERE user_type = 'admin' AND is_active = 1 ORDER BY user_id ASC LIMIT 1"
)->fetch(PDO::FETCH_ASSOC);

if (!$adminRow) {
    fwrite(STDERR, "FATAL: no active admin user found in users table\n");
    exit(1);
}

$adminId = (int)$adminRow['user_id'];
$token   = mintJwt($adminId, $jwtSecret, 120, (int)($adminRow['tenant_id'] ?? 1));

echo "Smoke test: $baseUrl\n";
echo "Admin user: #$adminId  |  Token expires in 120 s\n";
echo str_repeat('-', 70) . "\n";

// ─── HTTP helper ──────────────────────────────────────────────────────────────

$failures = 0;
$runStart = microtime(true);

/** Cloudflare caches 404s, so a fresh query string keeps a stale one from failing the run. */
function cache_bust(string $url): string
{
    return $url . (str_contains($url, '?') ? '&' : '?') . '_smoke=' . bin2hex(random_bytes(4));
}

function smoke_get(string $url, string $token): array
{
    $url = cache_bust($url);
    $ctx = stream_context_create([
        'http' => [
            'method'          => 'GET',
            'header'          => "Authorization: Bearer $token\r\nAccept: application/json\r\n",
            'timeout'         => 10,
            'ignore_errors'   => true,
        ],
        'ssl'  => ['verify_peer' => true, 'verify_peer_name' => true],
    ]);
    $raw  = @file_get_contents($url, false, $ctx);
    $code = 0;
    if (!empty($http_response_header)) {
        preg_match('#HTTP/\S+\s+(\d+)#', $http_response_header[0], $m);
        $code = (int)($m[1] ?? 0);
    }
    return ['code' => $code, 'body' => (string)$raw];
}

function check(string $label, string $url, int $wantCode, string $token, bool &$failures_ref): void
{
    global $failures;
    $r    = smoke_get($url, $token);
    $ok   = ($r['code'] === $wantCode);
    $mark = $ok ? '  OK ' : ' FAIL';
    if (!$ok) { $failures++; $failures_ref = true; }
    $json = @json_decode($r['body'], true);
    $note = is_array($json) ? ($json['message'] ?? '') : substr($r['body'], 0, 60);
    printf("%s  %3d  %s%s\n", $mark, $r['code'], $label, $note !== '' ? "  ($note)" : '');
}

$f = false;

// ─── List endpoints ───────────────────────────────────────────────────────────

$listEndpoints = [
    // Ops
    'GET /admin/ops/dashboard-stats'    => '/admin/ops/dashboard-stats',
    'GET /admin/ops/clients'            => '/admin/ops/clients',
    'GET /admin/ops/projects'           => '/admin/ops/projects',
    'GET /admin/ops/bugs'               => '/admin/ops/bugs',
    'GET /admin/ops/meetings'           => '/admin/ops/meetings',
    'GET /admin/ops/finance/summary'    => '/admin/ops/finance/summary',
    'GET /admin/ops/finance/payments'   => '/admin/ops/finance/payments',
    'GET /admin/ops/finance/expenses'   => '/admin/ops/finance/expenses',
    'GET /admin/ops/amc'                => '/admin/ops/amc',
    'GET /admin/ops/pitches'            => '/admin/ops/pitches',
    'GET /admin/ops/hiring'             => '/admin/ops/hiring',
    'GET /admin/ops/employees'          => '/admin/ops/employees',
    'GET /admin/ops/reports'            => '/admin/ops/reports',
    // Users / settings
    'GET /admin/users'                  => '/admin/users',
    'GET /admin/settings'               => '/admin/settings',
    'GET /admin/notifications'          => '/admin/notifications',
    // Sales
    'GET /admin/sales/dashboard'        => '/admin/sales/dashboard',
    'GET /admin/sales/leads'            => '/admin/sales/leads',
    'GET /admin/sales/followups'        => '/admin/sales/followups',
    'GET /admin/sales/meetings'         => '/admin/sales/meetings',
    'GET /admin/sales/tasks'            => '/admin/sales/tasks',
    'GET /admin/sales/challenges'       => '/admin/sales/challenges',
    'GET /admin/sales/calls'            => '/admin/sales/calls',
    // Global search
    'GET /admin/search?q=test'          => '/admin/search?q=test',
    // Auth me
    'GET /auth/me'                      => '/auth/me',
];

echo "\n[List endpoints]\n";
foreach ($listEndpoints as $label => $path) {
    check($label, $baseUrl . $path, 200, $token, $f);
}

// ─── Auth-failure test ────────────────────────────────────────────────────────

echo "\n[Auth failure tests]\n";
check('GET /admin/users  (no token → 401)',  $baseUrl . '/admin/users', 401, '', $f);
check('GET /admin/users  (bad token → 401)', $baseUrl . '/admin/users', 401, 'not.a.valid.token', $f);

// ─── Password update rejection test ──────────────────────────────────────────

echo "\n[Wrong-password rejection]\n";
$ctx = stream_context_create([
    'http' => [
        'method'        => 'PUT',
        'header'        => "Authorization: Bearer $token\r\nContent-Type: application/json\r\n",
        'content'       => json_encode([
            'current_password' => '__definitely_wrong_password__',
            'new_password'     => 'NewPass123!',
        ]),
        'timeout'       => 10,
        'ignore_errors' => true,
    ],
]);
$raw  = @file_get_contents(cache_bust($baseUrl . '/users/me/password'), false, $ctx);
$code = 0;
if (!empty($http_response_header)) {
    preg_match('#HTTP/\S+\s+(\d+)#', $http_response_header[0], $m);
    $code = (int)($m[1] ?? 0);
}
$ok   = ($code === 422 || $code === 400);
$mark = $ok ? '  OK ' : ' FAIL';
if (!$ok) { $failures++; }
printf("%s  %3d  PUT /users/me/password (wrong password → 400/422)\n", $mark, $code);

// ─── Print error_log lines produced during this run ──────────────────────────

echo "\n[api/error_log since run start]\n";
$logFile = $projectRoot . '/api/error_log';
if (file_exists($logFile)) {
    $lines    = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    $relevant = array_filter($lines, static function (string $line) use ($runStart): bool {
        // Lines with a timestamp: [DD-Mon-YYYY HH:MM:SS UTC]
        if (preg_match('#\[(\d{2}-\w{3}-\d{4} \d{2}:\d{2}:\d{2}[^\]]*)\]#', $line, $m)) {
            $ts = @strtotime($m[1]);
            return $ts !== false && $ts >= (int)$runStart;
        }
        return false;
    });
    if (empty($relevant)) {
        echo "  (none)\n";
    } else {
        foreach (array_slice(array_values($relevant), -20) as $line) {
            echo "  $line\n";
        }
    }
} else {
    echo "  (api/error_log does not exist — no errors logged)\n";
}

// ─── Summary ──────────────────────────────────────────────────────────────────

$elapsed = round(microtime(true) - $runStart, 2);
echo "\n" . str_repeat('-', 70) . "\n";
if ($failures === 0) {
    echo "PASS  All checks passed in {$elapsed}s\n";
    exit(0);
} else {
    echo "FAIL  $failures check(s) failed in {$elapsed}s\n";
    exit(1);
}
