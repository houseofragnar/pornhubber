<?php
// Secure Video & Media Streamer with full HTTP 206 Byte-Range support
require_once __DIR__ . '/config.php';

// Check if external drive is connected and readable before proceeding
$driveStatus = check_media_drive_status(MEDIA_DIR);
if (!$driveStatus['ready']) {
    header("HTTP/1.1 503 Service Unavailable");
    header("Retry-After: 5");
    echo "External storage drive (" . htmlspecialchars($driveStatus['drive']) . ") is disconnected or unreadable. Please reconnect your external storage device.";
    exit;
}

$fileName = isset($_GET['file']) ? trim($_GET['file']) : '';
if (empty($fileName)) {
    header("HTTP/1.1 400 Bad Request");
    echo "Filename required";
    exit;
}

// Sanitize filename to prevent directory traversal
$cleanName = str_replace(array('../', '..\\', '..'), '', $fileName);
$cleanName = ltrim($cleanName, "/\\");

$filePath = MEDIA_DIR . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $cleanName);

// Check if file exists
if (!is_file($filePath)) {
    header("HTTP/1.1 404 Not Found");
    echo "File not found: " . htmlspecialchars($cleanName);
    exit;
}

// Security: Verify file is inside MEDIA_DIR
$realPath = realpath($filePath);
$mediaReal = realpath(MEDIA_DIR);
if ($realPath === false || $mediaReal === false || strpos($realPath, $mediaReal) !== 0) {
    header("HTTP/1.1 403 Forbidden");
    echo "Access denied";
    exit;
}

// Determine MIME type
$ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
$mimeTypes = array(
    'mp4'  => 'video/mp4',
    'm4v'  => 'video/mp4',
    'mov'  => 'video/quicktime',
    'webm' => 'video/webm',
    'mkv'  => 'video/x-matroska',
    'avi'  => 'video/x-msvideo',
    'wmv'  => 'video/x-ms-wmv',
    'flv'  => 'video/x-flv',
    'ts'   => 'video/mp2t',
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png'  => 'image/png',
    'gif'  => 'image/gif',
    'webp' => 'image/webp'
);

$contentType = isset($mimeTypes[$ext]) ? $mimeTypes[$ext] : 'application/octet-stream';

// If it's a MOV file, many browsers (like Chrome/Edge) handle it better if served as video/mp4 when encoded with H.264
if ($ext === 'mov') {
    $contentType = 'video/mp4';
}

$size = filesize($filePath);
$start = 0;
$end = $size - 1;
$length = $size;

// Handle HTTP Range header for seeking and chunked buffering
if (isset($_SERVER['HTTP_RANGE'])) {
    $c_start = $start;
    $c_end = $end;

    list(, $range) = explode('=', $_SERVER['HTTP_RANGE'], 2);
    if (strpos($range, ',') !== false) {
        header('HTTP/1.1 416 Requested Range Not Satisfiable');
        header("Content-Range: bytes */$size");
        exit;
    }
    if ($range === '-') {
        $c_start = $size - 1;
    } else {
        $range = explode('-', $range);
        $c_start = (int)$range[0];
        $c_end = (isset($range[1]) && is_numeric($range[1])) ? (int)$range[1] : $size - 1;
    }
    $c_end = ($c_end > $end) ? $end : $c_end;
    if ($c_start > $c_end || $c_start > $size - 1 || $c_end >= $size) {
        header('HTTP/1.1 416 Requested Range Not Satisfiable');
        header("Content-Range: bytes */$size");
        exit;
    }
    $start = $c_start;
    $end = $c_end;
    $length = $end - $start + 1;

    header('HTTP/1.1 206 Partial Content');
    header("Content-Range: bytes $start-$end/$size");
} else {
    header('HTTP/1.1 200 OK');
}

// Clear any output buffers to prevent memory spikes
while (ob_get_level() > 0) {
    ob_end_clean();
}

@ini_set('max_execution_time', 0);
@ini_set('memory_limit', '256M');

header("Content-Type: $contentType");
header("Access-Control-Allow-Origin: *");
header("Accept-Ranges: bytes");
header("Content-Length: " . $length);
header("Cache-Control: max-age=2592000, public");
header("Last-Modified: " . gmdate('D, d M Y H:i:s', filemtime($filePath)) . ' GMT');
header("Content-Disposition: inline; filename=\"" . basename($filePath) . "\"");

// Stream file in 128KB chunks
$fp = fopen($filePath, 'rb');
if ($fp === false) {
    header("HTTP/1.1 500 Internal Server Error");
    exit;
}

fseek($fp, $start);
$bytesRemaining = $length;
$chunkSize = 131072; // 128 KB buffer

while ($bytesRemaining > 0 && !feof($fp) && !connection_aborted()) {
    $readSize = min($chunkSize, $bytesRemaining);
    $data = fread($fp, $readSize);
    if ($data === false) break;
    echo $data;
    flush();
    $bytesRemaining -= strlen($data);
}

fclose($fp);
exit;

