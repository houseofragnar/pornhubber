<?php
// $source = 'D:\\os\\og';
$source = 'E:\\0x\\og';
// Configuration for Personal Media Vault
error_reporting(E_ALL & ~E_NOTICE);

define('APP_NAME', 'PornHubber');
define('APP_VERSION', '1.0.0');

// Physical directory containing video and image files
define('MEDIA_DIR', $source);

// Web path to direct streaming (via Apache Junction)
define('MEDIA_WEB_PATH', 'media');

// Data storage paths
define('DATA_DIR', __DIR__ . DIRECTORY_SEPARATOR . 'data');
define('THUMB_DIR', DATA_DIR . DIRECTORY_SEPARATOR . 'thumbnails');
define('META_FILE', DATA_DIR . DIRECTORY_SEPARATOR . 'metadata.json');

// Allowed extensions
$VIDEO_EXTS = array('mp4', 'mov', 'webm', 'mkv', 'm4v', 'avi', 'wmv', 'flv', 'ts', '3gp');
$IMAGE_EXTS = array('jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp');
$PLAYLIST_EXTS = array('xspf', 'm3u', 'm3u8');

// Ensure data directories exist
if (!is_dir(DATA_DIR)) {
    @mkdir(DATA_DIR, 0777, true);
}
if (!is_dir(THUMB_DIR)) {
    @mkdir(THUMB_DIR, 0777, true);
}

// Helper to format byte sizes
function format_bytes($bytes, $precision = 1)
{
    $units = array('B', 'KB', 'MB', 'GB', 'TB');
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, $precision) . ' ' . $units[$pow];
}

// Helper to format duration in seconds to MM:SS or HH:MM:SS
function format_duration($seconds)
{
    $seconds = (int) round($seconds);
    if ($seconds <= 0)
        return '00:00';
    $h = floor($seconds / 3600);
    $m = floor(($seconds % 3600) / 60);
    $s = $seconds % 60;
    if ($h > 0) {
        return sprintf('%02d:%02d:%02d', $h, $m, $s);
    }
    return sprintf('%02d:%02d', $m, $s);
}

// Helper to get server URL
function get_server_url()
{
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
    $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
    return $proto . $host . '/xxx/';
}

// Extract drive letter from path (e.g. 'D:')
function get_drive_letter($path)
{
    if (preg_match('/^([a-zA-Z]:)/', $path, $matches)) {
        return strtoupper($matches[1]);
    }
    return '';
}

// Auto-discover if the target folder exists on another mounted drive letter
function find_directory_on_other_drives($originalPath)
{
    $rel = preg_replace('/^[a-zA-Z]:/', '', $originalPath);
    if (empty($rel))
        return null;

    $letters = range('C', 'Z');
    foreach ($letters as $letter) {
        $candidate = $letter . ':' . $rel;
        if (@is_dir($candidate) && @is_readable($candidate)) {
            return $candidate;
        }
    }
    return null;
}

// Check if external drive and target directory are connected and readable
function check_media_drive_status($dir = MEDIA_DIR)
{
    $drive = get_drive_letter($dir);
    $driveRoot = $drive ? ($drive . DIRECTORY_SEPARATOR) : '';

    $isDriveMounted = true;
    if (!empty($driveRoot)) {
        $isDriveMounted = @is_dir($driveRoot) || @file_exists($driveRoot);
    }

    // 1. Is drive letter mounted in Windows?
    if (!$isDriveMounted) {
        $alternatePath = find_directory_on_other_drives($dir);
        return array(
            'ready' => false,
            'connected' => false,
            'readable' => false,
            'drive' => $drive,
            'path' => $dir,
            'status' => 'drive_missing',
            'alternate_path' => $alternatePath,
            'message' => 'External storage drive (' . $drive . ') is disconnected or not mounted.'
        );
    }

    // 2. Does the specific folder exist on the drive?
    if (!@is_dir($dir)) {
        $alternatePath = find_directory_on_other_drives($dir);
        return array(
            'ready' => false,
            'connected' => true,
            'readable' => false,
            'drive' => $drive,
            'path' => $dir,
            'status' => 'folder_missing',
            'alternate_path' => $alternatePath,
            'message' => 'Drive ' . $drive . ' is connected, but folder "' . $dir . '" was not found.'
        );
    }

    // 3. Is the directory readable?
    if (!@is_readable($dir)) {
        return array(
            'ready' => false,
            'connected' => true,
            'readable' => false,
            'drive' => $drive,
            'path' => $dir,
            'status' => 'unreadable',
            'alternate_path' => null,
            'message' => 'Directory "' . $dir . '" is not readable (Permission or I/O error).'
        );
    }

    // 4. Can we list files inside?
    $testScan = @scandir($dir);
    if ($testScan === false) {
        return array(
            'ready' => false,
            'connected' => true,
            'readable' => false,
            'drive' => $drive,
            'path' => $dir,
            'status' => 'unreadable',
            'alternate_path' => null,
            'message' => 'Drive ' . $drive . ' is connected but failed to read directory contents.'
        );
    }

    // Drive & directory are ready and readable!
    $freeSpace = @disk_free_space($dir);
    $totalSpace = @disk_total_space($dir);

    return array(
        'ready' => true,
        'connected' => true,
        'readable' => true,
        'drive' => $drive,
        'path' => $dir,
        'status' => 'ready',
        'free_space' => $freeSpace ? format_bytes($freeSpace) : null,
        'total_space' => $totalSpace ? format_bytes($totalSpace) : null,
        'alternate_path' => null,
        'message' => 'External drive (' . $drive . ') is connected and readable.'
    );
}
