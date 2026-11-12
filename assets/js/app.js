/**
 * Main Application Logic & UI Controller
 */
const VaultUI = {
  allItems: [],
  filteredItems: [],
  currentTab: 'videos',
  currentSort: 'newest',
  currentView: 'grid',
  searchQuery: '',
  stats: null,
  photoItems: [],
  currentPhotoIndex: 0,
  currentFrameStyle: localStorage.getItem('vault_framestyle') || 'gold',
  isSlideshowPlaying: false,
  slideshowTimer: null,
  isZoomed: false,
  driveReady: false,
  driveStatus: null,
  drivePollTimer: null,
  isCheckingDrive: false,

  init: function() {
    this.bindDOM();
    this.fetchData();
  },

  bindDOM: function() {
    // Retry drive button
    const retryBtn = document.getElementById('retryDriveBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.checkDrive(true);
      });
    }

    // Drive status badge in header
    const driveBadge = document.getElementById('driveStatusBadge');
    if (driveBadge) {
      driveBadge.addEventListener('click', () => {
        this.checkDrive(true);
      });
    }

    // Search input
    const searchInput = document.getElementById('vaultSearchInput');
    const searchClear = document.getElementById('vaultSearchClear');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        searchClear.style.display = this.searchQuery ? 'block' : 'none';
        this.applyFilterAndSort();
      });
    }
    if (searchClear) {
      searchClear.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        searchClear.style.display = 'none';
        this.applyFilterAndSort();
      });
    }

    // Filter tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTab = btn.getAttribute('data-tab');
        
        // Toggle Gallery Exhibition Bar
        const galleryBar = document.getElementById('galleryBar');
        if (galleryBar) {
          galleryBar.style.display = (this.currentTab === 'photos') ? 'flex' : 'none';
        }

        this.applyFilterAndSort();
      });
    });

    // Gallery Frame Style Selector
    document.querySelectorAll('.frame-style-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.frame-style-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const style = btn.getAttribute('data-frame');
        this.setFrameStyle(style);
      });
    });

    // Sync saved frame style button active state
    const savedFrameBtn = document.querySelector(`.frame-style-btn[data-frame="${this.currentFrameStyle}"]`);
    if (savedFrameBtn) {
      document.querySelectorAll('.frame-style-btn').forEach(b => b.classList.remove('active'));
      savedFrameBtn.classList.add('active');
    }

    // Gallery Slideshow Buttons
    const startSlideshowBtn = document.getElementById('startSlideshowBtn');
    if (startSlideshowBtn) {
      startSlideshowBtn.addEventListener('click', () => {
        if (this.photoItems.length === 0) {
          this.showToast('No photos available in this collection');
          return;
        }
        const modal = document.getElementById('lightboxModal');
        if (!modal.classList.contains('active')) {
          this.openLightbox(this.photoItems[0]);
        }
        this.toggleSlideshow();
      });
    }

    const lightboxSlideshowBtn = document.getElementById('lightboxSlideshowBtn');
    if (lightboxSlideshowBtn) {
      lightboxSlideshowBtn.addEventListener('click', () => {
        this.toggleSlideshow();
      });
    }

    // Lightbox Zoom Controls
    const lightboxZoomBtn = document.getElementById('lightboxZoomBtn');
    const lightboxFrameWrap = document.getElementById('lightboxFrameWrap');
    if (lightboxZoomBtn && lightboxFrameWrap) {
      lightboxZoomBtn.addEventListener('click', () => {
        this.toggleZoom();
      });
    }

    const lightboxImg = document.getElementById('lightboxImg');
    if (lightboxImg) {
      lightboxImg.addEventListener('click', () => {
        this.toggleZoom();
      });
    }

    // Lightbox Download Button
    const lightboxDownloadBtn = document.getElementById('lightboxDownloadBtn');
    if (lightboxDownloadBtn) {
      lightboxDownloadBtn.addEventListener('click', () => {
        if (this.photoItems.length === 0) return;
        const currentItem = this.photoItems[this.currentPhotoIndex];
        if (!currentItem) return;
        const a = document.createElement('a');
        a.href = currentItem.stream_url;
        a.download = currentItem.filename;
        a.click();
        this.showToast('⬇️ Downloading artwork: ' + currentItem.filename);
      });
    }

    // Sort select
    const sortSelect = document.getElementById('vaultSortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        this.applyFilterAndSort();
      });
    }

    // View toggle (grid vs list)
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentView = btn.getAttribute('data-view');
        const grid = document.getElementById('mediaGrid');
        if (grid) {
          if (this.currentView === 'list') {
            grid.classList.add('list-view');
          } else {
            grid.classList.remove('list-view');
          }
        }
      });
    });

    // Shuffle / Surprise Me button
    const shuffleBtn = document.getElementById('shuffleBtn');
    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', () => {
        VaultPlayer.playRandom();
      });
    }

    // LAN IP Badge copy
    const lanBadge = document.getElementById('lanBadge');
    if (lanBadge) {
      lanBadge.addEventListener('click', () => {
        const url = lanBadge.getAttribute('data-url');
        if (url) {
          navigator.clipboard.writeText(url).then(() => {
            this.showToast(`📋 Copied LAN URL: ${url}`);
          }).catch(() => {
            prompt('Copy this URL to watch on your phone or tablet:', url);
          });
        }
      });
    }

    // Keyboard shortcuts modal
    const shortcutsBtn = document.getElementById('shortcutsBtn');
    const shortcutsModal = document.getElementById('shortcutsModal');
    const shortcutsClose = document.getElementById('shortcutsClose');
    if (shortcutsBtn && shortcutsModal) {
      shortcutsBtn.addEventListener('click', () => shortcutsModal.classList.add('active'));
    }
    if (shortcutsClose && shortcutsModal) {
      shortcutsClose.addEventListener('click', () => shortcutsModal.classList.remove('active'));
      shortcutsModal.addEventListener('click', (e) => {
        if (e.target === shortcutsModal) shortcutsModal.classList.remove('active');
      });
    }

    // Lightbox modal controls
    const lightboxModal = document.getElementById('lightboxModal');
    const lightboxClose = document.getElementById('lightboxClose');
    const lightboxPrev = document.getElementById('lightboxPrev');
    const lightboxNext = document.getElementById('lightboxNext');
    if (lightboxClose) {
      lightboxClose.addEventListener('click', () => {
        this.stopSlideshow();
        this.resetZoom();
        lightboxModal.classList.remove('active');
      });
    }
    if (lightboxPrev) {
      lightboxPrev.addEventListener('click', () => {
        this.resetZoom();
        this.navigateLightbox(-1);
      });
    }
    if (lightboxNext) {
      lightboxNext.addEventListener('click', () => {
        this.resetZoom();
        this.navigateLightbox(1);
      });
    }
    if (lightboxModal) {
      lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal) {
          this.stopSlideshow();
          this.resetZoom();
          lightboxModal.classList.remove('active');
        }
      });
    }

    // Lightbox keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (!lightboxModal || !lightboxModal.classList.contains('active')) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.resetZoom();
        this.navigateLightbox(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.resetZoom();
        this.navigateLightbox(1);
      } else if (e.key === 'Escape') {
        this.stopSlideshow();
        this.resetZoom();
        lightboxModal.classList.remove('active');
      } else if (e.key === ' ') {
        e.preventDefault();
        this.toggleSlideshow();
      }
    });

    // Player action favorites button
    const playerFavBtn = document.getElementById('playerFavBtn');
    if (playerFavBtn) {
      playerFavBtn.addEventListener('click', () => {
        if (VaultPlayer.currentItem) {
          this.toggleFavorite(VaultPlayer.currentItem.rel_path);
        }
      });
    }
  },

  fetchData: function() {
    this.updateDriveBadge('checking', 'Checking Drive...');

    fetch('api.php?action=list')
      .then(res => res.json())
      .then(data => {
        const driveStatus = data.drive_status || {};
        this.driveStatus = driveStatus;

        if (data.drive_ready === false || !data.success) {
          this.handleDriveDisconnected(driveStatus);
          return;
        }

        // Drive is connected & readable!
        this.handleDriveConnected(driveStatus);

        this.allItems = data.items || [];
        this.stats = data.stats || {};
        this.photoItems = this.allItems.filter(it => it.type === 'image');

        const pillText = document.getElementById('urlPillText');
        if (pillText && data.server_url) {
          pillText.textContent = data.server_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
        }
        this.updateStatsUI();

        // Update queue for player
        VaultPlayer.setQueue(this.allItems);

        // Apply filters and render
        this.applyFilterAndSort();

        // Initialize player engine
        VaultPlayer.init();
      })
      .catch(err => {
        console.error('Fetch error:', err);
        this.handleDriveDisconnected({
          drive: 'D:',
          path: 'D:\\os\\chi\\Best',
          message: 'Unable to communicate with storage drive: ' + err.message
        });
      });
  },

  handleDriveDisconnected: function(status) {
    this.driveReady = false;
    const driveLetter = status && status.drive ? status.drive : 'D:';
    this.updateDriveBadge('disconnected', `${driveLetter} Disconnected`);

    const screen = document.getElementById('driveScreen');
    const toolbar = document.querySelector('.vault-toolbar');
    const grid = document.getElementById('mediaGrid');

    if (screen) {
      screen.classList.add('active');
      const titleEl = document.getElementById('driveScreenTitle');
      const descEl = document.getElementById('driveScreenDesc');
      const pathEl = document.getElementById('drivePathBox');

      if (titleEl) titleEl.textContent = `External Drive Not Detected (${driveLetter})`;
      if (descEl) descEl.textContent = status && status.message 
        ? status.message 
        : `Drive ${driveLetter} is not connected. Please connect your external storage device.`;
      if (pathEl && status && status.path) pathEl.textContent = status.path;

      const altBanner = document.getElementById('alternateDriveBanner');
      if (status && status.alternate_path) {
        if (altBanner) altBanner.classList.add('visible');
        const altPath = document.getElementById('altDrivePath');
        if (altPath) altPath.textContent = status.alternate_path;
      } else if (altBanner) {
        altBanner.classList.remove('visible');
      }
    }

    if (toolbar) toolbar.style.display = 'none';
    if (grid) grid.style.display = 'none';

    // If player was playing, pause it safely
    if (VaultPlayer && VaultPlayer.video && !VaultPlayer.video.paused) {
      VaultPlayer.video.pause();
      this.showToast('⚠️ External drive disconnected. Playback paused.');
    }

    // Start background auto-poll to detect reconnection
    this.startDrivePolling();
  },

  handleDriveConnected: function(status) {
    this.driveReady = true;
    this.stopDrivePolling();

    const driveLetter = status && status.drive ? status.drive : 'D:';
    const freeSpace = status && status.free_space ? ` (${status.free_space} free)` : '';
    this.updateDriveBadge('ready', `${driveLetter} Ready${freeSpace}`);

    const screen = document.getElementById('driveScreen');
    const toolbar = document.querySelector('.vault-toolbar');
    const grid = document.getElementById('mediaGrid');

    if (screen) screen.classList.remove('active');
    if (toolbar) toolbar.style.display = 'flex';
    if (grid) grid.style.display = this.currentView === 'list' ? 'flex' : 'grid';
  },

  updateDriveBadge: function(state, text) {
    const badge = document.getElementById('driveStatusBadge');
    const label = document.getElementById('driveBadgeText');
    if (!badge || !label) return;

    badge.className = `drive-badge ${state}`;
    label.textContent = text;
  },

  startDrivePolling: function() {
    if (this.drivePollTimer) return;
    this.drivePollTimer = setInterval(() => {
      this.checkDrive(false);
    }, 3000);
  },

  stopDrivePolling: function() {
    if (this.drivePollTimer) {
      clearInterval(this.drivePollTimer);
      this.drivePollTimer = null;
    }
  },

  checkDrive: function(userTriggered = false) {
    if (this.isCheckingDrive) return;
    this.isCheckingDrive = true;

    if (userTriggered) {
      this.showToast('Checking external drive...');
      this.updateDriveBadge('checking', 'Checking...');
    }

    fetch('api.php?action=check_drive')
      .then(res => res.json())
      .then(data => {
        this.isCheckingDrive = false;
        if (data.drive_ready) {
          this.stopDrivePolling();
          this.showToast('🔌 Drive connected & verified! Loading media...');
          this.fetchData();
        } else {
          this.handleDriveDisconnected(data.drive_status);
          if (userTriggered) {
            this.showToast('❌ Drive is still not detected. Please verify connection.');
          }
        }
      })
      .catch(err => {
        this.isCheckingDrive = false;
        console.warn('Drive check failed:', err);
      });
  },

  updateStatsUI: function() {
    const vCount = this.stats.total_videos || 0;
    const pCount = this.stats.total_images || 0;
    const totalSize = this.stats.total_size_formatted || '0 GB';
    const totalDuration = this.stats.total_duration_formatted || '00:00';

    const countAll = document.getElementById('countAll');
    const countVideos = document.getElementById('countVideos');
    const countFavs = document.getElementById('countFavs');
    const countPhotos = document.getElementById('countPhotos');

    if (countAll) countAll.textContent = this.allItems.length;
    if (countVideos) countVideos.textContent = vCount;
    if (countPhotos) countPhotos.textContent = pCount;
    
    const favCount = this.allItems.filter(it => it.is_favorite).length;
    if (countFavs) countFavs.textContent = favCount;

    const statsHeader = document.getElementById('vaultHeaderStats');
    if (statsHeader) {
      statsHeader.textContent = `${vCount} Videos • ${totalDuration} • ${totalSize}`;
    }
  },

  applyFilterAndSort: function() {
    let items = [...this.allItems];

    // 1. Tab filter
    if (this.currentTab === 'videos') {
      items = items.filter(it => it.type === 'video');
    } else if (this.currentTab === 'favorites') {
      items = items.filter(it => it.is_favorite);
    } else if (this.currentTab === 'photos') {
      items = items.filter(it => it.type === 'image');
    } else if (this.currentTab === 'playlists') {
      items = items.filter(it => it.type === 'playlist' || it.extension === 'xspf');
    }

    // 2. Search query filter
    if (this.searchQuery) {
      items = items.filter(it => {
        const titleMatch = (it.title || '').toLowerCase().includes(this.searchQuery);
        const fileMatch = (it.filename || '').toLowerCase().includes(this.searchQuery);
        return titleMatch || fileMatch;
      });
    }

    // 3. Sorting
    items.sort((a, b) => {
      if (this.currentSort === 'newest') {
        return b.mtime - a.mtime;
      } else if (this.currentSort === 'oldest') {
        return a.mtime - b.mtime;
      } else if (this.currentSort === 'name_asc') {
        return (a.title || a.filename).localeCompare(b.title || b.filename);
      } else if (this.currentSort === 'duration') {
        return (b.duration || 0) - (a.duration || 0);
      } else if (this.currentSort === 'size') {
        return b.size - a.size;
      }
      return 0;
    });

    this.filteredItems = items;
    this.renderGrid();
  },

  renderGrid: function() {
    const grid = document.getElementById('mediaGrid');
    if (!grid) return;

    const isPhotosTab = (this.currentTab === 'photos');

    if (isPhotosTab) {
      grid.className = `media-grid gallery-mode frame-style-${this.currentFrameStyle}`;
    } else {
      grid.className = 'media-grid' + (this.currentView === 'list' ? ' list-view' : '');
    }

    if (this.filteredItems.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">${isPhotosTab ? '🏛️' : '🔍'}</div>
          <h3>${isPhotosTab ? 'Exhibition Gallery is Empty' : 'No media files found'}</h3>
          <p>${isPhotosTab ? 'No photographs found in this collection.' : 'No items match your active filter or search query.'}</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';

    this.filteredItems.forEach(item => {
      const card = (item.type === 'image' || isPhotosTab)
        ? this.createGalleryFrameElement(item)
        : this.createCardElement(item);
      grid.appendChild(card);
    });
  },

  createGalleryFrameElement: function(item) {
    const frame = document.createElement('div');
    frame.className = 'gallery-art-frame';
    frame.setAttribute('data-file', item.rel_path);

    // Overhead gallery spotlight
    const spotlight = document.createElement('div');
    spotlight.className = 'gallery-spotlight';
    frame.appendChild(spotlight);

    // Wall hanger detail
    const hanger = document.createElement('div');
    hanger.className = 'gallery-hanger';
    frame.appendChild(hanger);

    // Outer Molded Picture Frame
    const frameOuter = document.createElement('div');
    frameOuter.className = `art-frame-outer frame-${this.currentFrameStyle}`;

    // Museum Passe-Partout / Matte Board
    const frameMat = document.createElement('div');
    frameMat.className = 'art-frame-mat';

    // Artwork Canvas Wrap
    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'art-canvas-wrap';

    const img = document.createElement('img');
    img.className = 'art-picture';
    img.alt = item.title || item.filename;
    img.loading = 'lazy';
    img.src = item.stream_url;

    const glare = document.createElement('div');
    glare.className = 'art-glass-glare';

    // Favorite heart button
    const favBtn = document.createElement('button');
    favBtn.className = `art-fav-btn ${item.is_favorite ? 'is-fav' : ''}`;
    favBtn.innerHTML = item.is_favorite ? '❤️' : '🤍';
    favBtn.title = 'Add to Exhibition Favorites';
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFavorite(item.rel_path);
    });

    canvasWrap.appendChild(img);
    canvasWrap.appendChild(glare);
    canvasWrap.appendChild(favBtn);

    frameMat.appendChild(canvasWrap);
    frameOuter.appendChild(frameMat);
    frame.appendChild(frameOuter);

    // Museum Brass / Bronze Plaque
    const plaque = document.createElement('div');
    plaque.className = 'art-museum-plaque';

    const plaqueTitle = document.createElement('div');
    plaqueTitle.className = 'plaque-title';
    plaqueTitle.textContent = item.title || item.filename;
    plaqueTitle.title = item.filename;

    const plaqueMeta = document.createElement('div');
    plaqueMeta.className = 'plaque-meta';
    
    const dateStr = item.date_formatted ? item.date_formatted.split(' ')[0] : '2026';

    plaqueMeta.innerHTML = `
      <span>${dateStr}</span>
      <span class="plaque-dot">•</span>
      <span>${item.size_formatted}</span>
      <span class="plaque-dot">•</span>
      <span>${item.extension.toUpperCase()}</span>
    `;

    plaque.appendChild(plaqueTitle);
    plaque.appendChild(plaqueMeta);
    frame.appendChild(plaque);

    // Click handler: opens exhibition lightbox
    frame.addEventListener('click', () => {
      this.openLightbox(item);
    });

    return frame;
  },

  createCardElement: function(item) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.setAttribute('data-file', item.rel_path);

    if (VaultPlayer.currentItem && VaultPlayer.currentItem.rel_path === item.rel_path) {
      card.classList.add('playing');
    }

    // Thumbnail wrap
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'card-thumb-wrap';

    const img = document.createElement('img');
    img.className = 'card-thumb';
    img.alt = item.title;
    img.loading = 'lazy';
    img.src = item.thumb_url;

    // Enqueue client-side canvas thumbnail generator if it's a video
    if (item.type === 'video') {
      ThumbGen.queueThumbnail(item, img);
    }

    thumbWrap.appendChild(img);

    // Extension badge
    const extBadge = document.createElement('div');
    extBadge.className = 'card-ext-badge';
    extBadge.textContent = item.extension.toUpperCase();
    thumbWrap.appendChild(extBadge);

    // Duration badge for videos
    if (item.type === 'video') {
      const durBadge = document.createElement('div');
      durBadge.className = 'card-duration-badge';
      durBadge.textContent = item.duration_formatted && item.duration_formatted !== '00:00' 
        ? item.duration_formatted 
        : 'HD';
      thumbWrap.appendChild(durBadge);
    }

    // Favorite heart button
    const favBtn = document.createElement('button');
    favBtn.className = `card-fav-btn ${item.is_favorite ? 'is-fav' : ''}`;
    favBtn.innerHTML = item.is_favorite ? '❤️' : '🤍';
    favBtn.title = 'Favorite';
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFavorite(item.rel_path);
    });
    thumbWrap.appendChild(favBtn);

    // Progress bar for videos
    if (item.type === 'video') {
      const progBar = document.createElement('div');
      progBar.className = 'card-progress-bar';
      progBar.style.width = (item.watch_progress || 0) + '%';
      thumbWrap.appendChild(progBar);
    }

    // Card Body
    const body = document.createElement('div');
    body.className = 'card-body';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = item.title || item.filename;
    title.title = item.filename;

    const footer = document.createElement('div');
    footer.className = 'card-footer';
    footer.innerHTML = `
      <span>${item.size_formatted}</span>
      <span>${item.date_formatted}</span>
    `;

    body.appendChild(title);
    body.appendChild(footer);

    card.appendChild(thumbWrap);
    card.appendChild(body);

    // Click handler: play video or open photo lightbox
    card.addEventListener('click', () => {
      if (item.type === 'video') {
        VaultPlayer.loadAndPlay(item);
      } else if (item.type === 'image') {
        this.openLightbox(item);
      } else if (item.type === 'playlist') {
        VaultUI.showToast('📋 Playlist file: ' + item.filename);
      }
    });

    return card;
  },

  toggleFavorite: function(relPath) {
    const item = this.allItems.find(it => it.rel_path === relPath);
    if (!item) return;

    item.is_favorite = !item.is_favorite;

    // Update UI card
    const cardFavBtn = document.querySelector(`.video-card[data-file="${CSS.escape(relPath)}"] .card-fav-btn`);
    if (cardFavBtn) {
      cardFavBtn.classList.toggle('is-fav', item.is_favorite);
      cardFavBtn.innerHTML = item.is_favorite ? '❤️' : '🤍';
    }

    // Update gallery art frame button if present
    const artFavBtn = document.querySelector(`.gallery-art-frame[data-file="${CSS.escape(relPath)}"] .art-fav-btn`);
    if (artFavBtn) {
      artFavBtn.classList.toggle('is-fav', item.is_favorite);
      artFavBtn.innerHTML = item.is_favorite ? '❤️' : '🤍';
    }

    // Update player button if active
    if (VaultPlayer.currentItem && VaultPlayer.currentItem.rel_path === relPath) {
      const playerFav = document.getElementById('playerFavBtn');
      if (playerFav) {
        playerFav.classList.toggle('is-favorite', item.is_favorite);
        playerFav.innerHTML = item.is_favorite ? '❤️ Favorited' : '🤍 Favorite';
      }
    }

    this.updateStatsUI();
    this.showToast(item.is_favorite ? '❤️ Added to Favorites' : 'Removed from Favorites');

    // Sync to backend
    const formData = new FormData();
    formData.append('file', relPath);
    fetch('api.php?action=toggle_favorite', {
      method: 'POST',
      body: formData
    }).catch(err => console.error('Favorite sync failed:', err));
  },

  openLightbox: function(item) {
    const modal = document.getElementById('lightboxModal');
    const img = document.getElementById('lightboxImg');
    const title = document.getElementById('lightboxTitle');
    const dimensions = document.getElementById('lightboxDimensions');
    const index = document.getElementById('lightboxIndex');
    if (!modal || !img) return;

    this.currentPhotoIndex = this.photoItems.findIndex(it => it.rel_path === item.rel_path);
    if (this.currentPhotoIndex < 0) this.currentPhotoIndex = 0;

    this.resetZoom();

    img.src = item.stream_url;
    if (title) title.textContent = item.title || item.filename;
    if (dimensions) dimensions.textContent = `${item.size_formatted} • ${item.extension.toUpperCase()} • ${item.date_formatted}`;
    if (index) index.textContent = `Artwork ${this.currentPhotoIndex + 1} of ${this.photoItems.length}`;
    
    modal.classList.add('active');
  },

  navigateLightbox: function(dir) {
    if (this.photoItems.length === 0) return;
    this.currentPhotoIndex += dir;
    if (this.currentPhotoIndex >= this.photoItems.length) this.currentPhotoIndex = 0;
    if (this.currentPhotoIndex < 0) this.currentPhotoIndex = this.photoItems.length - 1;

    const nextItem = this.photoItems[this.currentPhotoIndex];
    this.openLightbox(nextItem);
  },

  setFrameStyle: function(style) {
    this.currentFrameStyle = style;
    localStorage.setItem('vault_framestyle', style);

    const grid = document.getElementById('mediaGrid');
    if (grid && this.currentTab === 'photos') {
      grid.className = `media-grid gallery-mode frame-style-${style}`;
    }

    document.querySelectorAll('.art-frame-outer').forEach(frame => {
      frame.className = `art-frame-outer frame-${style}`;
    });

    this.showToast(`🏛️ Frame style: ${style.charAt(0).toUpperCase() + style.slice(1)}`);
  },

  toggleSlideshow: function() {
    this.isSlideshowPlaying = !this.isSlideshowPlaying;
    const btn = document.getElementById('startSlideshowBtn');
    const lightboxBtn = document.getElementById('lightboxSlideshowBtn');
    const btnText = document.getElementById('slideshowBtnText');

    if (this.isSlideshowPlaying) {
      if (btn) btn.classList.add('btn-primary');
      if (lightboxBtn) {
        lightboxBtn.classList.add('active');
        lightboxBtn.textContent = '⏸ Pause';
      }
      if (btnText) btnText.textContent = '⏸ Pause Slideshow';
      this.showToast('▶ Exhibition Slideshow Started (4s)');

      this.slideshowTimer = setInterval(() => {
        this.navigateLightbox(1);
      }, 4000);
    } else {
      this.stopSlideshow();
    }
  },

  stopSlideshow: function() {
    this.isSlideshowPlaying = false;
    if (this.slideshowTimer) {
      clearInterval(this.slideshowTimer);
      this.slideshowTimer = null;
    }
    const btn = document.getElementById('startSlideshowBtn');
    const lightboxBtn = document.getElementById('lightboxSlideshowBtn');
    const btnText = document.getElementById('slideshowBtnText');

    if (btn) btn.classList.remove('btn-primary');
    if (lightboxBtn) {
      lightboxBtn.classList.remove('active');
      lightboxBtn.textContent = '▶ Slideshow';
    }
    if (btnText) btnText.textContent = 'Exhibition Slideshow';
  },

  toggleZoom: function() {
    const wrap = document.getElementById('lightboxFrameWrap');
    const btn = document.getElementById('lightboxZoomBtn');
    if (!wrap) return;
    this.isZoomed = !this.isZoomed;
    wrap.classList.toggle('zoomed', this.isZoomed);
    if (btn) {
      btn.classList.toggle('active', this.isZoomed);
      btn.textContent = this.isZoomed ? '🔍 100%' : '🔍 Zoom';
    }
  },

  resetZoom: function() {
    this.isZoomed = false;
    const wrap = document.getElementById('lightboxFrameWrap');
    const btn = document.getElementById('lightboxZoomBtn');
    if (wrap) wrap.classList.remove('zoomed');
    if (btn) {
      btn.classList.remove('active');
      btn.textContent = '🔍 Zoom';
    }
  },

  showToast: function(message) {
    let toast = document.getElementById('vaultToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'vaultToast';
      toast.className = 'vault-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');

    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2800);
  }
};

// Auto start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  VaultUI.init();
});
