<?php
/** @var Router $router */

// ─── Global search (the header Ctrl-K palette) ───────────────────────────────
$router->get('/admin/search',                            [AdminGlobalSearchController::class, 'index'],          'admin');
