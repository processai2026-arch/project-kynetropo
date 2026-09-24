<?php
/** @var Router $router */

// Users
$router->put('/users/{id}/password',      [UserController::class, 'changePassword'], true);
