<?php
// Xenium Designs — Contact Form Handler
// Sends enquiry email to marc@xeniumdesigns.com

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Method not allowed');
}

// Rate limiting — basic IP-based check (optional, requires writeable dir)
$rate_dir = __DIR__ . '/.rate_limits';
if (!is_dir($rate_dir)) mkdir($rate_dir, 0755, true);

$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rate_file = $rate_dir . '/' . md5($ip);
$last_submit = (int) @file_get_contents($rate_file);
if (time() - $last_submit < 60) {
    // Less than 60 seconds since last submission — reject
    http_response_code(429);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Please wait a moment before sending another message.']);
    exit;
}
file_put_contents($rate_file, (string) time());

// Collect and sanitise input
$name    = trim($_POST['name'] ?? '');
$email   = trim($_POST['email'] ?? '');
$business = trim($_POST['business'] ?? '');
$service = trim($_POST['service'] ?? '');
$message = trim($_POST['message'] ?? '');

// Validation
$errors = [];
if (empty($name) || mb_strlen($name) > 200) {
    $errors[] = 'Please enter your name.';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Please enter a valid email address.';
}
if (empty($message) || mb_strlen($message) > 5000) {
    $errors[] = 'Please enter a message.';
}

// Honeypot check — if filled, it's a bot (field should be empty)
if (!empty($_POST['website'])) {
    // Bot detected — silently succeed but don't send
    header('Content-Type: application/json');
    echo json_encode(['success' => true]);
    exit;
}

if (!empty($errors)) {
    http_response_code(422);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => implode(' ', $errors)]);
    exit;
}

// Map service value to readable label
$service_labels = [
    'analytics' => 'Analytics Dashboard',
    'sales'     => 'Sales & Revenue Dashboard',
    'email'     => 'Email & Marketing Dashboard',
    'multi'     => 'Multi-Source Dashboard',
    'other'     => 'Something Else / Not Sure',
];
$service_label = $service_labels[$service] ?? ($service ?: 'Not specified');

// Build email
$to = 'marc@xeniumdesigns.com';
$subject = 'New Enquiry from ' . $name;

$email_body = "New enquiry from the Xenium Designs website\n";
$email_body .= str_repeat('=', 50) . "\n\n";
$email_body .= "Name:     " . $name . "\n";
$email_body .= "Email:    " . $email . "\n";
$email_body .= "Business: " . ($business ?: 'Not provided') . "\n";
$email_body .= "Service:  " . $service_label . "\n\n";
$email_body .= "Message:\n" . $message . "\n\n";
$email_body .= str_repeat('-', 50) . "\n";
$email_body .= "IP: " . $ip . "\n";
$email_body .= "Time: " . date('Y-m-d H:i:s') . "\n";

$headers = [
    'From: Xenium Designs <noreply@xeniumdesigns.com>',
    'Reply-To: ' . $name . ' <' . $email . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'X-Mailer: XeniumEnquiry/1.0',
];

// Send
$sent = mail($to, $subject, $email_body, implode("\r\n", $headers));

if ($sent) {
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'message' => 'Thank you! We will get back to you within 24 hours.']);
} else {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Something went wrong. Please try again or email us directly.']);
}
