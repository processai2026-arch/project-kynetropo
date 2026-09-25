<?php
/**
 * Verify that every controller, model, service, and helper referenced
 * in api/routes/ still resolves to a file via the same autoloader order
 * used by api/index.php.
 *
 * Usage:  php scripts/verify-classes.php
 * Exit:   0 = all found, 1 = missing files
 */

$root     = dirname(__DIR__) . '/api';
$dirs     = ['helpers', 'middleware', 'services', 'models', 'controllers'];
$routeDir = $root . '/routes';

// ── 1. Extract every bare class name used as [ClassName::class in routes ──────
$routeFiles = glob($routeDir . '/*.php') ?: [];
sort($routeFiles);

$classes = [];
foreach ($routeFiles as $f) {
    $src = file_get_contents($f);
    preg_match_all('/\[([A-Za-z0-9_]+)::class/', $src, $m);
    foreach ($m[1] as $cls) {
        $classes[$cls] = $f;
    }
}

// ── 2. Also collect every class referenced inside controller files that exist ─
// (This catches models, services, helpers used by the kept controllers.)
$ctrlDir = $root . '/controllers';
foreach (glob($ctrlDir . '/*.php') ?: [] as $f) {
    $src = file_get_contents($f);
    // Pattern: ClassName::  or  new ClassName(
    preg_match_all('/\bnew ([A-Z][A-Za-z0-9_]+)\(/', $src, $m1);
    preg_match_all('/\b([A-Z][A-Za-z0-9_]+)::/', $src, $m2);
    foreach (array_merge($m1[1], $m2[1]) as $cls) {
        if (!isset($classes[$cls])) {
            $classes[$cls] = $f;
        }
    }
}

// Remove known built-ins / core classes that are not autoloaded files
$builtins = [
    'PDO', 'PDOException', 'Throwable', 'Exception', 'RuntimeException',
    'DateTime', 'DateTimeImmutable', 'ArrayObject', 'Response', 'Request',
    'Database', 'Router', 'AppException', 'PlatformDB', 'TenantContext',
    'TenantScope', 'AdminMiddleware', 'AuthMiddleware',
];
foreach ($builtins as $b) {
    unset($classes[$b]);
}

// ── 3. Resolve each class through the autoloader search order ──────────────────
$ok      = [];
$missing = [];

foreach ($classes as $cls => $src) {
    $found = false;
    foreach ($dirs as $dir) {
        if (file_exists($root . '/' . $dir . '/' . $cls . '.php')) {
            $ok[]  = $cls;
            $found = true;
            break;
        }
    }
    if (!$found) {
        // Might be a core file
        if (file_exists($root . '/core/' . $cls . '.php')) {
            $ok[] = $cls;
        } else {
            $missing[] = ['class' => $cls, 'src' => $src];
        }
    }
}

// ── 4. Report ─────────────────────────────────────────────────────────────────
$ok = array_unique($ok);
sort($ok);

echo "Classes resolved OK (" . count($ok) . "):\n";
foreach ($ok as $c) {
    echo "  ✓ $c\n";
}

if ($missing) {
    echo "\nMISSING (" . count($missing) . "):\n";
    foreach ($missing as $item) {
        echo "  ✗ {$item['class']}  (first seen in: {$item['src']})\n";
    }
    exit(1);
}

echo "\nAll classes resolved. Dead-code cleanup is clean.\n";
exit(0);
