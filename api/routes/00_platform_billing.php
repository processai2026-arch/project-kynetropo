<?php
/** @var Router $router */

// Public self-service signup / pricing
$router->post('/signup', [SignupController::class, 'signup']);
