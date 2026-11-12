<?php
// API endpoint for Video Vault
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

require_once __DIR__ . '/config.php';

// Helper to load metadata
function load_metadata() {
    if (file_exists(META_FILE)) {
        $json = @file_get_contents(META_FILE);
        $data = @json_decode($json, true);
        if (is_array($data)) {
            return $data;
        }
    }
    return array(
        'favorites' => array(),
        'progress' => array(),
        'tags' => array(),
        'titles' => array(),
        'ratings' => array(),
        'markers' => array()
    );
}

// Helper to save metadata
function save_metadata($data) {
    return @file_put_contents(META_FILE, json_encode($data, JSON_PRETTY_PRINT));
}

// Helper to parse VLC XSPF playlist for durations and track ordering
function parse_xspf_playlist($filePath) {
    $durations = array();
    $tracks = array();
    if (!file_exists($filePath)) {
        return array('durations' => $durations, 'tracks' => $tracks);
    }
    $xml = @simplexml_load_file($filePath);
    if ($xml && isset($xml->trackList) && isset($xml->trackList->track)) {
        foreach ($xml->trackList->track as $track) {
            $loc = (string)$track->location;
            $fileName = basename(urldecode($loc));
            $durationMs = isset($track->duration) ? (int)$track->duration : 0;
            $durationSec = (int)round($durationMs / 1000);
            if (!empty($fileName)) {
                $durations[$fileName] = $durationSec;
                $tracks[] = array(
                    'file' => $fileName,
                    'duration' => $durationSec,
                    'duration_formatted' => format_duration($durationSec)
                );
            }
        }
    }
    return array('durations' => $durations, 'tracks' => $tracks);
}

// Scan directory recursively or flatly
function scan_media_dir($dir, $baseDir, &$knownDurations, &$meta) {
    global $VIDEO_EXTS, $IMAGE_EXTS, $PLAYLIST_EXTS;

    $items = array();
    if (!is_dir($dir)) {
        return $items;
    }

    $entries = scandir($dir);
    if ($entries === false) {
        return $items;
    }

    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }

        $fullPath = $dir . DIRECTORY_SEPARATOR . $entry;
        $relPath = ltrim(str_replace($baseDir, '', $fullPath), DIRECTORY_SEPARATOR);
        $relPath = str_replace(DIRECTORY_SEPARATOR, '/', $relPath);

        if (is_dir($fullPath)) {
            // Optional recursion for subdirectories
            $subItems = scan_media_dir($fullPath, $baseDir, $knownDurations, $meta);
            $items = array_merge($items, $subItems);
            continue;
        }

        $ext = strtolower(pathinfo($entry, PATHINFO_EXTENSION));
        $type = 'other';
        if (in_array($ext, $VIDEO_EXTS)) {
            $type = 'video';
        } elseif (in_array($ext, $IMAGE_EXTS)) {
            $type = 'image';
        } elseif (in_array($ext, $PLAYLIST_EXTS)) {
            $type = 'playlist';
        }

        // We only return videos, images, and playlists
        if ($type === 'other') {
            continue;
        }

        $size = filesize($fullPath);
        $mtime = filemtime($fullPath);
        $duration = isset($knownDurations[$entry]) ? $knownDurations[$entry] : 0;
        
        $itemKey = $relPath;
        $isFav = isset($meta['favorites'][$itemKey]) ? (bool)$meta['favorites'][$itemKey] : false;
        $customTitle = isset($meta['titles'][$itemKey]) ? $meta['titles'][$itemKey] : '';
        $rating = isset($meta['ratings'][$itemKey]) ? (int)$meta['ratings'][$itemKey] : 0;
        $itemTags = isset($meta['tags'][$itemKey]) ? (array)$meta['tags'][$itemKey] : array();
        $itemMarkers = isset($meta['markers'][$itemKey]) ? (array)$meta['markers'][$itemKey] : array();
        
        $progress = isset($meta['progress'][$itemKey]) ? $meta['progress'][$itemKey] : array();
        $lastTime = isset($progress['time']) ? (float)$progress['time'] : 0;
        $percent = isset($progress['percent']) ? (float)$progress['percent'] : 0;

        $directAvailable = false;
        $directFolder = __DIR__ . DIRECTORY_SEPARATOR . MEDIA_WEB_PATH;
        if (is_dir($directFolder) && file_exists($directFolder . DIRECTORY_SEPARATOR . $entry)) {
            $directAvailable = true;
        }

        $streamUrl = $directAvailable 
            ? (MEDIA_WEB_PATH . '/' . rawurlencode($entry)) 
            : ('stream.php?file=' . rawurlencode($relPath));

        $items[] = array(
            'id' => md5($relPath),
            'filename' => $entry,
            'rel_path' => $relPath,
            'title' => !empty($customTitle) ? $customTitle : pathinfo($entry, PATHINFO_FILENAME),
            'custom_title' => $customTitle,
            'extension' => $ext,
            'type' => $type,
            'size' => $size,
            'size_formatted' => format_bytes($size),
            'mtime' => $mtime,
            'date_formatted' => date('M j, Y H:i', $mtime),
            'duration' => $duration,
            'duration_formatted' => format_duration($duration),
            'is_favorite' => $isFav,
            'rating' => $rating,
            'tags' => $itemTags,
            'markers' => $itemMarkers,
            'last_position' => $lastTime,
            'watch_progress' => $percent,
            'stream_url' => $streamUrl,
            'fallback_stream_url' => 'stream.php?file=' . rawurlencode($relPath),
            'thumb_url' => 'thumb.php?file=' . rawurlencode($relPath)
        );
    }

    return $items;
}

$action = isset($_GET['action']) ? $_GET['action'] : 'list';
$meta = load_metadata();
$driveStatus = check_media_drive_status(MEDIA_DIR);

// Fast lightweight ping for drive connectivity check
if ($action === 'check_drive') {
    echo json_encode(array(
        'success' => true,
        'drive_ready' => (bool)$driveStatus['ready'],
        'drive_status' => $driveStatus
    ));
    exit;
}

// 1. Action: List all media files
if ($action === 'list') {
    // Check if external drive is connected and readable before proceeding
    if (!$driveStatus['ready']) {
        echo json_encode(array(
            'success' => false,
            'drive_ready' => false,
            'drive_status' => $driveStatus,
            'error' => $driveStatus['message'],
            'app_name' => APP_NAME,
            'directory' => MEDIA_DIR,
            'server_url' => get_server_url(),
            'stats' => array(
                'total_items' => 0,
                'total_videos' => 0,
                'total_images' => 0,
                'total_size' => 0,
                'total_size_formatted' => '0 B',
                'total_duration' => 0,
                'total_duration_formatted' => '00:00'
            ),
            'playlist_tracks' => array(),
            'items' => array()
        ));
        exit;
    }

    $xspfPath = MEDIA_DIR . DIRECTORY_SEPARATOR . 'list.xspf';
    $playlistInfo = parse_xspf_playlist($xspfPath);
    $knownDurations = $playlistInfo['durations'];

    $mediaItems = scan_media_dir(MEDIA_DIR, MEDIA_DIR, $knownDurations, $meta);

    // Compute summary stats
    $totalVideos = 0;
    $totalImages = 0;
    $totalSize = 0;
    $totalDuration = 0;

    foreach ($mediaItems as $item) {
        $totalSize += $item['size'];
        if ($item['type'] === 'video') {
            $totalVideos++;
            $totalDuration += $item['duration'];
        } elseif ($item['type'] === 'image') {
            $totalImages++;
        }
    }

    echo json_encode(array(
        'success' => true,
        'drive_ready' => true,
        'drive_status' => $driveStatus,
        'app_name' => APP_NAME,
        'directory' => MEDIA_DIR,
        'server_url' => get_server_url(),
        'stats' => array(
            'total_items' => count($mediaItems),
            'total_videos' => $totalVideos,
            'total_images' => $totalImages,
            'total_size' => $totalSize,
            'total_size_formatted' => format_bytes($totalSize),
            'total_duration' => $totalDuration,
            'total_duration_formatted' => format_duration($totalDuration)
        ),
        'playlist_tracks' => $playlistInfo['tracks'],
        'items' => $mediaItems
    ));
    exit;
}

// 2. Action: Toggle favorite
if ($action === 'toggle_favorite') {
    $file = isset($_POST['file']) ? trim($_POST['file']) : '';
    if (empty($file)) {
        echo json_encode(array('success' => false, 'error' => 'File missing'));
        exit;
    }
    $clean = str_replace(array('../', '..\\'), '', $file);
    $current = isset($meta['favorites'][$clean]) ? (bool)$meta['favorites'][$clean] : false;
    $newStatus = !$current;
    if ($newStatus) {
        $meta['favorites'][$clean] = true;
    } else {
        unset($meta['favorites'][$clean]);
    }
    save_metadata($meta);
    echo json_encode(array('success' => true, 'is_favorite' => $newStatus));
    exit;
}

// 3. Action: Save watch progress
if ($action === 'save_progress') {
    $file = isset($_POST['file']) ? trim($_POST['file']) : '';
    $time = isset($_POST['time']) ? (float)$_POST['time'] : 0;
    $duration = isset($_POST['duration']) ? (float)$_POST['duration'] : 0;

    if (empty($file)) {
        echo json_encode(array('success' => false, 'error' => 'File missing'));
        exit;
    }

    $clean = str_replace(array('../', '..\\'), '', $file);
    $percent = 0;
    if ($duration > 0) {
        $percent = min(100, round(($time / $duration) * 100, 1));
    }

    $meta['progress'][$clean] = array(
        'time' => round($time, 1),
        'duration' => round($duration, 1),
        'percent' => $percent,
        'updated_at' => time()
    );

    save_metadata($meta);
    echo json_encode(array('success' => true, 'percent' => $percent, 'time' => $time));
    exit;
}

// 4. Action: Save custom metadata (rating, custom title, tags)
if ($action === 'save_meta') {
    $file = isset($_POST['file']) ? trim($_POST['file']) : '';
    if (empty($file)) {
        echo json_encode(array('success' => false, 'error' => 'File missing'));
        exit;
    }
    $clean = str_replace(array('../', '..\\'), '', $file);

    if (isset($_POST['title'])) {
        $meta['titles'][$clean] = trim($_POST['title']);
    }
    if (isset($_POST['rating'])) {
        $meta['ratings'][$clean] = max(0, min(5, (int)$_POST['rating']));
    }
    if (isset($_POST['tags'])) {
        $tags = is_array($_POST['tags']) ? $_POST['tags'] : explode(',', (string)$_POST['tags']);
        $cleanTags = array();
        foreach ($tags as $t) {
            $t = trim($t);
            if (!empty($t)) $cleanTags[] = $t;
        }
        $meta['tags'][$clean] = array_unique($cleanTags);
    }

    save_metadata($meta);
    echo json_encode(array('success' => true, 'data' => isset($meta['titles'][$clean]) ? $meta['titles'][$clean] : ''));
    exit;
}

// 5. Action: Update duration (when browser metadata detects exact video duration)
if ($action === 'save_duration') {
    $file = isset($_POST['file']) ? trim($_POST['file']) : '';
    $duration = isset($_POST['duration']) ? (int)round($_POST['duration']) : 0;
    if (!empty($file) && $duration > 0) {
        $clean = str_replace(array('../', '..\\'), '', $file);
        if (!isset($meta['durations'])) {
            $meta['durations'] = array();
        }
        $meta['durations'][$clean] = $duration;
        save_metadata($meta);
        echo json_encode(array('success' => true, 'duration' => $duration));
        exit;
    }
}

// Default fallback
echo json_encode(array('success' => false, 'error' => 'Unknown action'));
exit;
