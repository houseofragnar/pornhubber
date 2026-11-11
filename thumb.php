<?php
// Thumbnail server and saver
require_once __DIR__ . '/config.php';

$action = isset($_GET['action']) ? $_GET['action'] : 'get';
$file = isset($_GET['file']) ? trim($_GET['file']) : '';

if (empty($file) && isset($_POST['file'])) {
    $file = trim($_POST['file']);
}

if (empty($file)) {
    header("HTTP/1.1 400 Bad Request");
    echo "File parameter missing";
    exit;
}

$cleanFile = str_replace(array('../', '..\\', '..'), '', $file);
$cleanFile = ltrim($cleanFile, "/\\");
$thumbHash = md5($cleanFile);
$thumbPath = THUMB_DIR . DIRECTORY_SEPARATOR . $thumbHash . '.jpg';

// Action: Save client-generated thumbnail base64 image
if ($action === 'save' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = isset($_POST['image']) ? $_POST['image'] : '';
    if (empty($data)) {
        $jsonInput = @json_decode(file_get_contents('php://input'), true);
        if (isset($jsonInput['image'])) {
            $data = $jsonInput['image'];
        }
    }

    if (!empty($data)) {
        if (strpos($data, ',') !== false) {
            list(, $data) = explode(',', $data);
        }
        $decoded = base64_decode($data);
        if ($decoded !== false && strlen($decoded) > 100) {
            file_put_contents($thumbPath, $decoded);
            header('Content-Type: application/json');
            echo json_encode(array('success' => true, 'thumb' => 'thumb.php?file=' . urlencode($cleanFile)));
            exit;
        }
    }
    header('Content-Type: application/json');
    echo json_encode(array('success' => false, 'error' => 'Invalid image payload'));
    exit;
}

// Action: Get thumbnail
if (file_exists($thumbPath)) {
    header('Content-Type: image/jpeg');
    header('Cache-Control: max-age=604800, public');
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s', filemtime($thumbPath)) . ' GMT');
    readfile($thumbPath);
    exit;
}

// If it's an image file from the media folder, we can serve it or generate a thumbnail with GD
$origFilePath = MEDIA_DIR . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $cleanFile);
$ext = strtolower(pathinfo($cleanFile, PATHINFO_EXTENSION));

if (file_exists($origFilePath) && in_array($ext, array('jpg', 'jpeg', 'png', 'webp', 'gif'))) {
    // Generate GD thumbnail if possible
    if (extension_loaded('gd') && function_exists('imagecreatefromjpeg')) {
        $srcImg = null;
        if ($ext === 'jpg' || $ext === 'jpeg') {
            $srcImg = @imagecreatefromjpeg($origFilePath);
        } elseif ($ext === 'png') {
            $srcImg = @imagecreatefrompng($origFilePath);
        } elseif ($ext === 'gif') {
            $srcImg = @imagecreatefromgif($origFilePath);
        }

        if ($srcImg) {
            $origW = imagesx($srcImg);
            $origH = imagesy($srcImg);
            $targetW = 480;
            $targetH = (int)round(($origH / $origW) * $targetW);

            $dstImg = imagecreatetruecolor($targetW, $targetH);
            imagecopyresampled($dstImg, $srcImg, 0, 0, 0, 0, $targetW, $targetH, $origW, $origH);
            imagejpeg($dstImg, $thumbPath, 85);
            imagedestroy($srcImg);
            imagedestroy($dstImg);

            header('Content-Type: image/jpeg');
            header('Cache-Control: max-age=604800, public');
            readfile($thumbPath);
            exit;
        }
    }
    
    // Fallback: send raw image
    header('Content-Type: image/' . ($ext === 'jpg' ? 'jpeg' : $ext));
    readfile($origFilePath);
    exit;
}

// Default SVG placeholder if no thumbnail exists yet
header('Content-Type: image/svg+xml');
header('Cache-Control: max-age=3600');
?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">
  <rect width="480" height="270" fill="#171720"/>
  <circle cx="240" cy="135" r="42" fill="#242432"/>
  <polygon points="233,120 255,135 233,150" fill="#f59e0b"/>
  <text x="240" y="210" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#71717a" text-anchor="middle">Click to preview</text>
</svg>

