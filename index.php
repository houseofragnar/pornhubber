<?php
require_once __DIR__ . '/config.php';
$serverUrl = get_server_url();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title><?php echo htmlspecialchars(APP_NAME); ?></title>
  <meta name="description" content="Personal Media Vault and High-Performance Local Video Player">
  
  <!-- Favicon icon using data SVG -->
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎬</text></svg>">
  
  <!-- Custom Styles -->
  <link rel="stylesheet" href="assets/css/app.css?v=<?php echo filemtime(__DIR__ . '/assets/css/app.css'); ?>">
</head>
<body>

  <!-- Top Header Bar -->
  <header class="vault-header">
    <div class="vault-brand">
      <span class="vault-logo-badge">XXX</span>
      <div class="vault-brand-title">PRIVATE <span>VAULT</span></div>
    </div>

    <!-- Live Search Input -->
    <div class="vault-search-wrap">
      <span class="vault-search-icon">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      </span>
      <input type="text" id="vaultSearchInput" class="vault-search-input" placeholder="Search videos and photos..." autocomplete="off">
      <span id="vaultSearchClear" class="vault-search-clear">&times;</span>
    </div>

    <!-- Header Actions -->
    <div class="vault-header-actions">
      <!-- External Drive Status Pill -->
      <button type="button" id="driveStatusBadge" class="drive-badge checking" title="External Storage Status (Click to re-check)">
        <span class="drive-dot"></span>
        <span id="driveBadgeText">Checking Drive...</span>
      </button>

      <!-- Server Access Pill -->
      <button type="button" id="lanBadge" class="lan-badge" data-url="<?php echo htmlspecialchars($serverUrl); ?>" title="Click to copy site URL">
        <span class="lan-dot"></span>
        <span id="urlPillText">Localhost:80</span>
      </button>

      <!-- Surprise Me / Shuffle Button -->
      <button type="button" id="shuffleBtn" class="btn btn-primary" title="Play a random video now">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
        <span>Surprise Me</span>
      </button>

      <!-- Keyboard Shortcuts Help Button -->
      <button type="button" id="shortcutsBtn" class="btn-icon-only" title="Keyboard Shortcuts (?)">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      </button>
    </div>
  </header>

  <!-- Main Content Container -->
  <main class="vault-container">

    <!-- External Drive Disconnected Warning Screen -->
    <section id="driveScreen" class="drive-screen">
      <div class="drive-icon-wrap">
        <svg width="44" height="44" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <rect x="2" y="4" width="20" height="16" rx="2"></rect>
          <line x1="6" y1="12" x2="6" y2="12.01"></line>
          <line x1="10" y1="12" x2="10" y2="12.01"></line>
          <line x1="14" y1="12" x2="14" y2="12.01"></line>
          <line x1="18" y1="12" x2="18" y2="12.01"></line>
        </svg>
        <span class="drive-icon-badge">!</span>
      </div>

      <h2 id="driveScreenTitle" class="drive-screen-title">External Drive Not Detected</h2>
      <p id="driveScreenDesc" class="drive-screen-desc">
        The media directory on your external storage device is not reachable.
        Please make sure your external drive is plugged into your PC and recognized by Windows.
      </p>

      <div>
        <span id="drivePathBox" class="drive-path-box"><?php echo htmlspecialchars(MEDIA_DIR); ?></span>
      </div>

      <!-- Optional alternate drive hint if found on another letter -->
      <div id="alternateDriveBanner" class="alternate-drive-banner">
        💡 <strong>Found folder on another drive:</strong> <span id="altDrivePath"></span>
      </div>

      <div class="drive-actions">
        <button type="button" id="retryDriveBtn" class="btn btn-primary">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          <span>Retry Connection Now</span>
        </button>
      </div>

      <div class="drive-polling-indicator">
        <span class="radar-spinner"></span>
        <span id="drivePollingText">Auto-detecting drive every 3 seconds...</span>
      </div>
    </section>

    <!-- Active Video Player Stage (Theater Area) -->
    <section id="playerStage" class="player-stage">
      <div class="video-wrapper">
        <!-- Resume playback banner prompt -->
        <div id="resumeBanner" class="resume-banner">
          <span id="resumeText" class="resume-banner-text">Resume playback?</span>
          <button type="button" id="resumeBtn" class="resume-btn">Resume</button>
          <span id="resumeDismiss" class="resume-dismiss">&times;</span>
        </div>

        <video id="vaultVideoPlayer" controls playsinline preload="metadata">
          Your browser does not support HTML5 video playback.
        </video>
      </div>

      <!-- Player Controls & Video Info -->
      <div class="player-bottom-bar">
        <div class="player-info-row">
          <div class="player-title-box">
            <h2 id="currentPlayerTitle" class="current-video-title">Select a video to play</h2>
            <div class="current-video-meta">
              <span id="currentMetaExt" class="meta-pill accent">MP4</span>
              <span id="currentMetaSize" class="meta-pill">0 MB</span>
              <span id="currentMetaDate" class="meta-pill">Date</span>
            </div>
          </div>

          <!-- Video Action Buttons -->
          <div class="player-actions-row">
            <button type="button" id="saveSegmentBtn" class="action-btn segment-btn" onclick="VaultPlayer.toggleSegmentDrawer()" title="Create and Save a Favorite Video Segment">✂️ Cut Segment</button>
            <button type="button" id="playerFavBtn" class="action-btn fav-btn">🤍 Favorite</button>
            <button type="button" id="theaterBtn" class="action-btn" title="Toggle wide theater mode">🎦 Theater</button>
            <button type="button" id="pipBtn" class="action-btn" title="Picture in Picture">🖼️ PiP</button>
            <button type="button" id="screenshotBtn" class="action-btn" title="Capture high-res snapshot & set thumbnail">📸 Snapshot</button>
            <button type="button" id="downloadBtn" class="action-btn" title="Direct download file">⬇️ Save</button>
            <button type="button" id="closeStageBtn" class="action-btn" title="Close video player">✕ Close</button>
          </div>
        </div>

        <!-- Secondary Playback Quick Bar -->
        <div class="player-quick-controls">
          <div class="quick-left">
            <button type="button" id="prevVideoBtn" class="ctrl-btn" title="Previous video ([)">⏮ Prev</button>
            <button type="button" id="skipBackBtn" class="ctrl-btn" title="Skip -10s (Left Arrow / J)">⏪ 10s</button>
            <button type="button" id="skipFwdBtn" class="ctrl-btn" title="Skip +10s (Right Arrow / L)">10s ⏩</button>
            <button type="button" id="nextVideoBtn" class="ctrl-btn" title="Next video (])">Next ⏭</button>
            <button type="button" id="loopBtn" class="ctrl-btn" title="Repeat this video (R)">🔂 Repeat</button>
            <button type="button" id="autoNextBtn" class="ctrl-btn active" title="Play next video automatically">⏭ Auto-Next</button>
          </div>

          <div class="quick-right">
            <label style="font-size: 0.8rem; color: var(--text-muted); margin-right: 4px;">Speed:</label>
            <select id="speedSelect" class="sort-select" style="padding: 4px 8px;">
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1.0" selected>1.0x (Normal)</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2.0">2.0x</option>
            </select>
          </div>
        </div>

        <!-- Segment Creator Panel (Collapsible) -->
        <div id="segmentCreatorDrawer" class="segment-creator-drawer">
          <div class="segment-drawer-header">
            <h4>✂️ Save Favorite Segment / Clip Range</h4>
            <button type="button" id="closeSegmentDrawerBtn" class="drawer-close-btn" onclick="VaultPlayer.closeSegmentDrawer()" title="Close">&times;</button>
          </div>
          <div class="segment-drawer-body">
            <div class="segment-field">
              <label>Segment Title / Description:</label>
              <input type="text" id="segmentTitleInput" class="segment-input" placeholder="e.g. Favorite Scene, Best Part, Climax" autocomplete="off">
            </div>

            <div class="segment-range-grid">
              <!-- Start Point -->
              <div class="segment-point-box">
                <div class="point-header">
                  <label>🟢 Start Time:</label>
                  <button type="button" id="setStartTimeCurrentBtn" class="point-capture-btn" onclick="VaultPlayer.captureCurrentTime('start')" title="Capture current playback timestamp">⏱️ Current Time</button>
                </div>
                <div class="point-inputs">
                  <input type="text" id="segmentStartInput" class="segment-input time-input" placeholder="00:00" value="00:00">
                  <div class="point-adjusters">
                    <button type="button" class="nudge-btn" data-target="start" data-delta="-5" onclick="VaultPlayer.nudgeTime('start', -5)">-5s</button>
                    <button type="button" class="nudge-btn" data-target="start" data-delta="-1" onclick="VaultPlayer.nudgeTime('start', -1)">-1s</button>
                    <button type="button" class="nudge-btn" data-target="start" data-delta="1" onclick="VaultPlayer.nudgeTime('start', 1)">+1s</button>
                    <button type="button" class="nudge-btn" data-target="start" data-delta="5" onclick="VaultPlayer.nudgeTime('start', 5)">+5s</button>
                  </div>
                </div>
              </div>

              <!-- End Point -->
              <div class="segment-point-box">
                <div class="point-header">
                  <label>🔴 End Time:</label>
                  <button type="button" id="setEndTimeCurrentBtn" class="point-capture-btn" onclick="VaultPlayer.captureCurrentTime('end')" title="Capture current playback timestamp">⏱️ Current Time</button>
                </div>
                <div class="point-inputs">
                  <input type="text" id="segmentEndInput" class="segment-input time-input" placeholder="00:00" value="00:00">
                  <div class="point-adjusters">
                    <button type="button" class="nudge-btn" data-target="end" data-delta="-5" onclick="VaultPlayer.nudgeTime('end', -5)">-5s</button>
                    <button type="button" class="nudge-btn" data-target="end" data-delta="-1" onclick="VaultPlayer.nudgeTime('end', -1)">-1s</button>
                    <button type="button" class="nudge-btn" data-target="end" data-delta="1" onclick="VaultPlayer.nudgeTime('end', 1)">+1s</button>
                    <button type="button" class="nudge-btn" data-target="end" data-delta="5" onclick="VaultPlayer.nudgeTime('end', 5)">+5s</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Segment Preview & Actions -->
            <div class="segment-drawer-footer">
              <div class="segment-duration-info">
                <span>Clip Duration: <strong id="segmentDurationPreview">00:00</strong></span>
              </div>
              <div class="segment-drawer-actions">
                <button type="button" id="previewSegmentBtn" class="btn btn-secondary" onclick="VaultPlayer.previewCurrentSegment()">▶ Preview Clip</button>
                <button type="button" id="confirmSaveSegmentBtn" class="btn btn-primary" onclick="VaultPlayer.saveCurrentSegment()">💾 Save Segment</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Video Saved Segments Bar Under Player -->
        <div id="videoSegmentsSection" class="video-segments-section">
          <div class="segments-section-header">
            <span class="segments-section-title">⭐ Favorite Segments for this Video (<span id="videoSegmentsCount">0</span>):</span>
          </div>
          <div id="videoSegmentsList" class="video-segments-list">
            <!-- Populated dynamically with segment chips -->
          </div>
        </div>
      </div>
    </section>

    <!-- Navigation Filter Toolbar -->
    <div class="vault-toolbar">
      <div class="filter-tabs">
        <button type="button" class="tab-btn active" data-tab="videos">
          <span>🎬 Videos</span>
          <span id="countVideos" class="tab-count">0</span>
        </button>
        <button type="button" class="tab-btn" data-tab="all">
          <span>📁 All Files</span>
          <span id="countAll" class="tab-count">0</span>
        </button>
        <button type="button" class="tab-btn" data-tab="favorites">
          <span>❤️ Favorites</span>
          <span id="countFavs" class="tab-count">0</span>
        </button>
        <button type="button" class="tab-btn" data-tab="segments">
          <span>⭐ Segments</span>
          <span id="countSegments" class="tab-count">0</span>
        </button>
        <button type="button" class="tab-btn" data-tab="photos">
          <span>📷 Photos</span>
          <span id="countPhotos" class="tab-count">0</span>
        </button>
      </div>

      <div class="toolbar-controls">
        <!-- Sort Select -->
        <select id="vaultSortSelect" class="sort-select">
          <option value="newest">📅 Newest First</option>
          <option value="oldest">📅 Oldest First</option>
          <option value="name_asc">🔤 Name (A - Z)</option>
          <option value="duration">⏱️ Duration (Longest)</option>
          <option value="size">💾 Size (Largest)</option>
        </select>

        <!-- View Switcher -->
        <div class="view-mode-toggle">
          <button type="button" class="view-btn active" data-view="grid" title="Grid View">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          </button>
          <button type="button" class="view-btn" data-view="list" title="List View">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Gallery Exhibition Controls (Active in Photos Mode) -->
    <div id="galleryBar" class="gallery-exhibition-bar" style="display: none;">
      <div class="gallery-bar-left">
        <span class="gallery-label">🏛️ Frame Style:</span>
        <div class="frame-style-selector">
          <button type="button" class="frame-style-btn active" data-frame="gold" title="Gilded Gold Museum Frame">
            <span class="frame-swatch gold-swatch"></span>
            <span>Gilded Gold</span>
          </button>
          <button type="button" class="frame-style-btn" data-frame="walnut" title="Royal Walnut Wood Frame">
            <span class="frame-swatch walnut-swatch"></span>
            <span>Walnut Wood</span>
          </button>
          <button type="button" class="frame-style-btn" data-frame="noir" title="Modern Gallery Noir Frame">
            <span class="frame-swatch noir-swatch"></span>
            <span>Gallery Noir</span>
          </button>
          <button type="button" class="frame-style-btn" data-frame="studio" title="Minimalist Studio Frame">
            <span class="frame-swatch studio-swatch"></span>
            <span>Minimalist</span>
          </button>
        </div>
      </div>
      <div class="gallery-bar-right">
        <button type="button" id="startSlideshowBtn" class="btn btn-secondary" title="Start Fullscreen Exhibition Slideshow">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          <span id="slideshowBtnText">Exhibition Slideshow</span>
        </button>
      </div>
    </div>

    <!-- Media Grid / Cards List -->
    <div id="mediaGrid" class="media-grid">
      <!-- Populated dynamically by app.js -->
    </div>
  </main>

  <!-- Photo Lightbox Modal -->
  <div id="lightboxModal" class="lightbox-modal">
    <div class="lightbox-header">
      <h3 id="lightboxTitle">Exhibition Photograph</h3>
      <div class="lightbox-actions">
        <button type="button" id="lightboxZoomBtn" class="lightbox-action-btn" title="Toggle Zoom">🔍 Zoom</button>
        <button type="button" id="lightboxSlideshowBtn" class="lightbox-action-btn" title="Toggle Auto Slideshow">▶ Slideshow</button>
        <button type="button" id="lightboxDownloadBtn" class="lightbox-action-btn" title="Download High-Res Original">⬇️ Save</button>
        <button type="button" id="lightboxClose" class="modal-close" style="color:#fff; font-size:2rem; margin-left: 12px;">&times;</button>
      </div>
    </div>
    <div class="lightbox-content">
      <button type="button" id="lightboxPrev" class="lightbox-nav-btn lightbox-prev">&#10094;</button>
      <div id="lightboxFrameWrap" class="lightbox-frame-wrap">
        <img id="lightboxImg" class="lightbox-img" src="" alt="Exhibition photo">
      </div>
      <button type="button" id="lightboxNext" class="lightbox-nav-btn lightbox-next">&#10095;</button>
    </div>
    <div class="lightbox-footer">
      <span id="lightboxDimensions">Original Capture</span>
      <span id="lightboxIndex">1 of 1</span>
    </div>
  </div>

  <!-- Keyboard Shortcuts Cheat Sheet Modal -->
  <div id="shortcutsModal" class="vault-modal-overlay">
    <div class="vault-modal">
      <div class="modal-header">
        <h3 class="modal-title">⌨️ Keyboard Shortcuts</h3>
        <span id="shortcutsClose" class="modal-close">&times;</span>
      </div>
      <div class="modal-body">
        <div class="shortcut-row">
          <span>Play / Pause</span>
          <span class="kbd">Space</span> or <span class="kbd">K</span>
        </div>
        <div class="shortcut-row">
          <span>Seek Backward 10s</span>
          <span class="kbd">◀</span> or <span class="kbd">J</span>
        </div>
        <div class="shortcut-row">
          <span>Seek Forward 10s</span>
          <span class="kbd">▶</span> or <span class="kbd">L</span>
        </div>
        <div class="shortcut-row">
          <span>Volume Up / Down</span>
          <span class="kbd">▲</span> / <span class="kbd">▼</span>
        </div>
        <div class="shortcut-row">
          <span>Mute / Unmute</span>
          <span class="kbd">M</span>
        </div>
        <div class="shortcut-row">
          <span>Toggle Fullscreen</span>
          <span class="kbd">F</span>
        </div>
        <div class="shortcut-row">
          <span>Toggle Theater Mode</span>
          <span class="kbd">T</span>
        </div>
        <div class="shortcut-row">
          <span>Picture in Picture (PiP)</span>
          <span class="kbd">P</span>
        </div>
        <div class="shortcut-row">
          <span>Capture Frame Snapshot</span>
          <span class="kbd">S</span>
        </div>
        <div class="shortcut-row">
          <span>Toggle Repeat / Loop</span>
          <span class="kbd">R</span>
        </div>
        <div class="shortcut-row">
          <span>Previous / Next Video</span>
          <span class="kbd">[</span> / <span class="kbd">]</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Scripts -->
  <script src="assets/js/thumb.js?v=<?php echo filemtime(__DIR__ . '/assets/js/thumb.js'); ?>"></script>
  <script src="assets/js/player.js?v=<?php echo filemtime(__DIR__ . '/assets/js/player.js'); ?>"></script>
  <script src="assets/js/app.js?v=<?php echo filemtime(__DIR__ . '/assets/js/app.js'); ?>"></script>
</body>
</html>
