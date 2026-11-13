/**
 * Video Player Engine & Controller
 */
const VaultPlayer = {
  video: null,
  stage: null,
  currentItem: null,
  itemsList: [],
  currentIndex: -1,
  autoNext: true,
  loopCurrent: false,
  currentSegment: null,
  isLoopingSegment: false,
  progressInterval: null,
  nextCountdownTimer: null,

  init: function() {
    this.video = document.getElementById('vaultVideoPlayer');
    this.stage = document.getElementById('playerStage');
    if (!this.video || !this.stage) return;
    if (this._initialized) return;
    this._initialized = true;

    this.bindEvents();
    this.bindKeyboardShortcuts();
    
    // Load preferences
    const savedAutoNext = localStorage.getItem('vault_autonext');
    if (savedAutoNext !== null) {
      this.autoNext = savedAutoNext === 'true';
      this.updateAutoNextButton();
    }
  },

  setQueue: function(items) {
    this.itemsList = items.filter(it => it.type === 'video');
  },

  loadAndPlay: function(item, shouldPlay = true, startAt = null, activeSegment = null) {
    if (!item) return;
    this.currentItem = item;
    this.currentSegment = activeSegment;
    this.isLoopingSegment = false;
    this.currentIndex = this.itemsList.findIndex(it => it.rel_path === item.rel_path);

    // Show stage
    this.stage.classList.add('active');

    // Update Player UI details
    document.getElementById('currentPlayerTitle').textContent = item.title || item.filename;
    document.getElementById('currentMetaExt').textContent = item.extension.toUpperCase();
    document.getElementById('currentMetaSize').textContent = item.size_formatted;
    document.getElementById('currentMetaDate').textContent = item.date_formatted;
    
    const favBtn = document.getElementById('playerFavBtn');
    if (favBtn) {
      if (item.is_favorite) {
        favBtn.classList.add('is-favorite');
        favBtn.innerHTML = '❤️ Favorited';
      } else {
        favBtn.classList.remove('is-favorite');
        favBtn.innerHTML = '🤍 Favorite';
      }
    }

    // Set video source
    this.video.src = item.stream_url;
    this.video.load();

    // Close segment drawer if open and render saved segments for this video
    this.closeSegmentDrawer();
    this.renderVideoSegments();

    // Handle jump to startAt or check resume
    const resumeBanner = document.getElementById('resumeBanner');
    if (resumeBanner) resumeBanner.classList.remove('visible');

    if (startAt !== null && startAt >= 0) {
      this.video.addEventListener('loadedmetadata', () => {
        this.video.currentTime = startAt;
        if (shouldPlay) this.video.play().catch(() => {});
      }, { once: true });
    } else {
      // Check resume position
      const resumeText = document.getElementById('resumeText');
      const lastPos = item.last_position || 0;
      const progress = item.watch_progress || 0;

      // Show resume banner if previously watched > 10s and < 95%
      if (lastPos > 10 && progress < 95) {
        if (resumeBanner && resumeText) {
          resumeText.textContent = `Resume from ${this.formatTime(lastPos)}?`;
          resumeBanner.classList.add('visible');
          
          document.getElementById('resumeBtn').onclick = () => {
            this.video.currentTime = lastPos;
            resumeBanner.classList.remove('visible');
            this.video.play();
          };
          document.getElementById('resumeDismiss').onclick = () => {
            resumeBanner.classList.remove('visible');
          };

          // Auto hide after 8s
          setTimeout(() => {
            if (resumeBanner) resumeBanner.classList.remove('visible');
          }, 8000);
        }
      }
    }

    // Start playing
    if (shouldPlay && startAt === null) {
      const playPromise = this.video.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.log('Autoplay deferred or error:', err);
          // Try fallback stream handler if direct failed
          if (this.video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
            console.log('Retrying with fallback stream handler...');
            this.video.src = item.fallback_stream_url;
            this.video.play().catch(() => {});
          }
        });
      }
    }

    // Smooth scroll to stage
    this.stage.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Highlight card in grid
    document.querySelectorAll('.video-card').forEach(c => c.classList.remove('playing'));
    const activeCard = document.querySelector(`.video-card[data-file="${CSS.escape(item.rel_path)}"]`);
    if (activeCard) activeCard.classList.add('playing');

    // Update browser title
    document.title = `▶ ${item.title || item.filename} - XXX Vault`;
  },

  bindEvents: function() {
    const video = this.video;

    // Save progress periodically & check segment loop
    video.addEventListener('timeupdate', () => {
      // Check segment boundary if watching an active segment
      if (this.currentSegment) {
        if (video.currentTime >= this.currentSegment.end) {
          if (this.isLoopingSegment) {
            video.currentTime = this.currentSegment.start;
            video.play();
          } else {
            this.currentSegment = null;
            document.querySelectorAll('.segment-chip').forEach(c => c.classList.remove('active-clip'));
            VaultUI.showToast('Reached end of segment');
          }
        }
      }

      // Throttle progress saves to every 5 seconds
      const now = Date.now();
      if (!this._lastSave || now - this._lastSave > 5000) {
        this._lastSave = now;
        this.saveCurrentProgress();
      }
    });

    // Handle video end
    video.addEventListener('ended', () => {
      this.saveCurrentProgress(true);
      if (this.loopCurrent) {
        video.currentTime = 0;
        video.play();
      } else if (this.autoNext) {
        this.playNext(true);
      }
    });

    // Error handler for fallback
    video.addEventListener('error', (e) => {
      console.warn('Video playback error, trying fallback stream:', e);
      if (this.currentItem && this.video.src !== this.currentItem.fallback_stream_url) {
        this.video.src = this.currentItem.fallback_stream_url;
        this.video.play().catch(err => console.error('Fallback failed:', err));
      }
    });

    // Theater mode toggle
    const theaterBtn = document.getElementById('theaterBtn');
    if (theaterBtn) {
      theaterBtn.addEventListener('click', () => {
        this.stage.classList.toggle('theater-mode');
        theaterBtn.classList.toggle('active');
      });
    }

    // Loop toggle
    const loopBtn = document.getElementById('loopBtn');
    if (loopBtn) {
      loopBtn.addEventListener('click', () => {
        this.loopCurrent = !this.loopCurrent;
        video.loop = this.loopCurrent;
        loopBtn.classList.toggle('active', this.loopCurrent);
        VaultUI.showToast(this.loopCurrent ? '🔂 Repeat current: ON' : 'Repeat: OFF');
      });
    }

    // Auto-Next toggle
    const autoNextBtn = document.getElementById('autoNextBtn');
    if (autoNextBtn) {
      autoNextBtn.addEventListener('click', () => {
        this.autoNext = !this.autoNext;
        localStorage.setItem('vault_autonext', this.autoNext);
        this.updateAutoNextButton();
        VaultUI.showToast(this.autoNext ? '⏭ Auto-Next: ON' : '⏭ Auto-Next: OFF');
      });
    }

    // Skip backward 10s
    const skipBackBtn = document.getElementById('skipBackBtn');
    if (skipBackBtn) {
      skipBackBtn.addEventListener('click', () => {
        video.currentTime = Math.max(0, video.currentTime - 10);
      });
    }

    // Skip forward 10s
    const skipFwdBtn = document.getElementById('skipFwdBtn');
    if (skipFwdBtn) {
      skipFwdBtn.addEventListener('click', () => {
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
      });
    }

    // Previous video button
    const prevBtn = document.getElementById('prevVideoBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.playPrevious());
    }

    // Next video button
    const nextBtn = document.getElementById('nextVideoBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.playNext());
    }

    // Speed selector
    const speedSelect = document.getElementById('speedSelect');
    if (speedSelect) {
      speedSelect.addEventListener('change', (e) => {
        video.playbackRate = parseFloat(e.target.value);
        VaultUI.showToast(`Speed: ${e.target.value}x`);
      });
    }

    // PiP button
    const pipBtn = document.getElementById('pipBtn');
    if (pipBtn) {
      pipBtn.addEventListener('click', async () => {
        try {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          } else if (document.pictureInPictureEnabled) {
            await video.requestPictureInPicture();
          }
        } catch (err) {
          console.warn('PiP error:', err);
        }
      });
    }

    // Screenshot button
    const screenshotBtn = document.getElementById('screenshotBtn');
    if (screenshotBtn) {
      screenshotBtn.addEventListener('click', () => {
        this.takeScreenshot();
      });
    }

    // Download button
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        if (!this.currentItem) return;
        const a = document.createElement('a');
        a.href = this.currentItem.stream_url;
        a.download = this.currentItem.filename;
        a.click();
      });
    }

    // Close stage button
    const closeStageBtn = document.getElementById('closeStageBtn');
    if (closeStageBtn) {
      closeStageBtn.addEventListener('click', () => {
        video.pause();
        this.stage.classList.remove('active');
        document.querySelectorAll('.video-card').forEach(c => c.classList.remove('playing'));
        document.title = 'XXX Private Vault';
      });
    }

    // Segment Creator Drawer toggle
    const saveSegmentBtn = document.getElementById('saveSegmentBtn');
    if (saveSegmentBtn) {
      saveSegmentBtn.addEventListener('click', () => {
        this.toggleSegmentDrawer();
      });
    }

    const closeDrawerBtn = document.getElementById('closeSegmentDrawerBtn');
    if (closeDrawerBtn) {
      closeDrawerBtn.addEventListener('click', () => {
        this.closeSegmentDrawer();
      });
    }

    // Capture current time buttons
    const setStartBtn = document.getElementById('setStartTimeCurrentBtn');
    if (setStartBtn) {
      setStartBtn.addEventListener('click', () => {
        const cur = this.video ? this.video.currentTime : 0;
        document.getElementById('segmentStartInput').value = this.formatTime(cur);
        this.updateDrawerDurationPreview();
      });
    }

    const setEndBtn = document.getElementById('setEndTimeCurrentBtn');
    if (setEndBtn) {
      setEndBtn.addEventListener('click', () => {
        const cur = this.video ? this.video.currentTime : 0;
        document.getElementById('segmentEndInput').value = this.formatTime(cur);
        this.updateDrawerDurationPreview();
      });
    }

    // Nudge buttons for fine-tuning
    document.querySelectorAll('.nudge-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        const delta = parseFloat(btn.getAttribute('data-delta')) || 0;
        const inputId = target === 'start' ? 'segmentStartInput' : 'segmentEndInput';
        const input = document.getElementById(inputId);
        if (input) {
          let sec = this.parseTimeToSeconds(input.value);
          sec = Math.max(0, sec + delta);
          input.value = this.formatTime(sec);
          this.updateDrawerDurationPreview();
        }
      });
    });

    // Time input live duration update
    ['segmentStartInput', 'segmentEndInput'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateDrawerDurationPreview());
      }
    });

    // Preview clip button
    const previewBtn = document.getElementById('previewSegmentBtn');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        this.previewCurrentSegment();
      });
    }

    // Confirm save segment button
    const confirmSaveBtn = document.getElementById('confirmSaveSegmentBtn');
    if (confirmSaveBtn) {
      confirmSaveBtn.addEventListener('click', () => {
        this.saveCurrentSegment();
      });
    }
  },

  updateAutoNextButton: function() {
    const btn = document.getElementById('autoNextBtn');
    if (btn) {
      btn.classList.toggle('active', this.autoNext);
    }
  },

  playNext: function(withToast = false) {
    if (this.itemsList.length === 0) return;
    let nextIdx = this.currentIndex + 1;
    if (nextIdx >= this.itemsList.length) {
      nextIdx = 0; // loop back to first
    }
    const nextItem = this.itemsList[nextIdx];
    if (withToast) {
      VaultUI.showToast(`Playing next: ${nextItem.title || nextItem.filename}`);
    }
    this.loadAndPlay(nextItem);
  },

  playPrevious: function() {
    if (this.itemsList.length === 0) return;
    let prevIdx = this.currentIndex - 1;
    if (prevIdx < 0) {
      prevIdx = this.itemsList.length - 1;
    }
    this.loadAndPlay(this.itemsList[prevIdx]);
  },

  playRandom: function() {
    if (this.itemsList.length === 0) return;
    const randomIdx = Math.floor(Math.random() * this.itemsList.length);
    this.loadAndPlay(this.itemsList[randomIdx]);
  },

  saveCurrentProgress: function(completed = false) {
    if (!this.currentItem || !this.video) return;
    const time = completed ? (this.video.duration || 0) : this.video.currentTime;
    const duration = this.video.duration || this.currentItem.duration || 0;
    if (time <= 0 || duration <= 0) return;

    const percent = Math.min(100, Math.round((time / duration) * 100));
    this.currentItem.last_position = time;
    this.currentItem.watch_progress = percent;

    // Update progress bar on corresponding card
    const cardProgress = document.querySelector(`.video-card[data-file="${CSS.escape(this.currentItem.rel_path)}"] .card-progress-bar`);
    if (cardProgress) {
      cardProgress.style.width = percent + '%';
    }

    const formData = new FormData();
    formData.append('file', this.currentItem.rel_path);
    formData.append('time', time);
    formData.append('duration', duration);

    fetch('api.php?action=save_progress', {
      method: 'POST',
      body: formData
    }).catch(err => console.log('Progress save error:', err));
  },

  takeScreenshot: function() {
    if (!this.video || !this.currentItem) return;
    const dataUrl = ThumbGen.capturePlayerFrame(this.video, this.currentItem.rel_path, true);
    if (!dataUrl) return;

    // Trigger instant download of full frame
    const link = document.createElement('a');
    link.download = `snapshot_${this.currentItem.filename}_${Math.floor(this.video.currentTime)}s.jpg`;
    link.href = dataUrl;
    link.click();

    VaultUI.showToast('📸 Screenshot saved & set as poster thumbnail!');
  },

  bindKeyboardShortcuts: function() {
    window.addEventListener('keydown', (e) => {
      // Ignore if user is typing in search input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const video = this.video;
      if (!video) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (video.paused) video.play(); else video.pause();
          break;
        case 'ArrowLeft':
        case 'j':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'ArrowRight':
        case 'l':
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          VaultUI.showToast(`Volume: ${Math.round(video.volume * 100)}%`);
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          VaultUI.showToast(`Volume: ${Math.round(video.volume * 100)}%`);
          break;
        case 'm':
        case 'M':
          video.muted = !video.muted;
          VaultUI.showToast(video.muted ? '🔇 Muted' : '🔊 Unmuted');
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            this.stage.requestFullscreen().catch(() => video.requestFullscreen());
          }
          break;
        case 't':
        case 'T':
          document.getElementById('theaterBtn')?.click();
          break;
        case 'p':
        case 'P':
          document.getElementById('pipBtn')?.click();
          break;
        case 's':
        case 'S':
          this.takeScreenshot();
          break;
        case 'r':
        case 'R':
          document.getElementById('loopBtn')?.click();
          break;
        case '[':
          this.playPrevious();
          break;
        case ']':
          this.playNext();
          break;
        case '?':
          document.getElementById('shortcutsBtn')?.click();
          break;
      }
    });
  },

  parseTimeToSeconds: function(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    const parts = str.trim().split(':').map(p => parseFloat(p) || 0);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
      return parts[0];
    }
    return 0;
  },

  toggleSegmentDrawer: function(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    const now = Date.now();
    if (this._lastToggle && (now - this._lastToggle < 350)) {
      return; // Debounce rapid / duplicate events
    }
    this._lastToggle = now;

    const drawer = document.getElementById('segmentCreatorDrawer');
    if (!drawer) return;

    const isVisible = drawer.classList.contains('active') || drawer.style.display === 'block';
    if (isVisible) {
      this.closeSegmentDrawer();
    } else {
      this.openSegmentDrawer();
    }
  },

  openSegmentDrawer: function() {
    const drawer = document.getElementById('segmentCreatorDrawer');
    const btn = document.getElementById('saveSegmentBtn');
    if (!drawer) return;

    if (!this.currentItem) {
      VaultUI.showToast('⚠️ Please select a video to cut a segment');
      return;
    }

    // Make sure player stage is visible
    if (this.stage && !this.stage.classList.contains('active')) {
      this.stage.classList.add('active');
    }

    const cur = (this.video && typeof this.video.currentTime === 'number' && !isNaN(this.video.currentTime))
      ? this.video.currentTime
      : 0;

    let dur = 60;
    if (this.video && typeof this.video.duration === 'number' && !isNaN(this.video.duration) && isFinite(this.video.duration) && this.video.duration > 0) {
      dur = this.video.duration;
    } else if (this.currentItem && typeof this.currentItem.duration === 'number' && this.currentItem.duration > 0) {
      dur = this.currentItem.duration;
    } else {
      dur = Math.max(60, cur + 60);
    }

    const startIn = document.getElementById('segmentStartInput');
    const endIn = document.getElementById('segmentEndInput');
    const titleIn = document.getElementById('segmentTitleInput');

    if (startIn) startIn.value = this.formatTime(cur);
    if (endIn) endIn.value = this.formatTime(Math.min(dur, cur + 30));
    if (titleIn) titleIn.value = '';

    this.updateDrawerDurationPreview();

    drawer.style.display = 'block';
    drawer.classList.add('active');
    if (btn) btn.classList.add('active');

    try {
      drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {}
  },

  closeSegmentDrawer: function() {
    const drawer = document.getElementById('segmentCreatorDrawer');
    const btn = document.getElementById('saveSegmentBtn');
    if (drawer) {
      drawer.style.display = 'none';
      drawer.classList.remove('active');
    }
    if (btn) btn.classList.remove('active');
  },

  captureCurrentTime: function(which) {
    const cur = (this.video && typeof this.video.currentTime === 'number' && !isNaN(this.video.currentTime))
      ? this.video.currentTime
      : 0;
    const inputId = (which === 'start') ? 'segmentStartInput' : 'segmentEndInput';
    const input = document.getElementById(inputId);
    if (input) {
      input.value = this.formatTime(cur);
      this.updateDrawerDurationPreview();
      VaultUI.showToast(`⏱️ Set ${which} time: ${this.formatTime(cur)}`);
    }
  },

  nudgeTime: function(which, delta) {
    const inputId = (which === 'start') ? 'segmentStartInput' : 'segmentEndInput';
    const input = document.getElementById(inputId);
    if (input) {
      let sec = this.parseTimeToSeconds(input.value);
      sec = Math.max(0, sec + delta);
      input.value = this.formatTime(sec);
      this.updateDrawerDurationPreview();
    }
  },

  updateDrawerDurationPreview: function() {
    const startIn = document.getElementById('segmentStartInput');
    const endIn = document.getElementById('segmentEndInput');
    const preview = document.getElementById('segmentDurationPreview');
    if (!startIn || !endIn || !preview) return;

    const start = this.parseTimeToSeconds(startIn.value);
    const end = this.parseTimeToSeconds(endIn.value);
    const diff = end - start;

    if (diff > 0) {
      preview.textContent = this.formatTime(diff);
      preview.style.color = 'var(--accent)';
    } else {
      preview.textContent = 'Invalid (end must be > start)';
      preview.style.color = 'var(--accent-danger)';
    }
  },

  previewCurrentSegment: function() {
    if (!this.video) return;
    const start = this.parseTimeToSeconds(document.getElementById('segmentStartInput')?.value);
    const end = this.parseTimeToSeconds(document.getElementById('segmentEndInput')?.value);

    if (end <= start) {
      VaultUI.showToast('⚠️ End point must be after start point');
      return;
    }

    this.currentSegment = {
      id: 'preview',
      title: 'Preview Clip',
      start: start,
      end: end
    };
    this.isLoopingSegment = true;

    this.video.currentTime = start;
    this.video.play().catch(() => {});
    VaultUI.showToast(`▶ Previewing clip: ${this.formatTime(start)} ➔ ${this.formatTime(end)} (Looping)`);
  },

  saveCurrentSegment: function() {
    if (!this.currentItem) {
      VaultUI.showToast('⚠️ Please play a video first before saving a segment');
      return;
    }
    const start = this.parseTimeToSeconds(document.getElementById('segmentStartInput')?.value);
    const end = this.parseTimeToSeconds(document.getElementById('segmentEndInput')?.value);
    const title = document.getElementById('segmentTitleInput')?.value?.trim();

    if (end <= start) {
      VaultUI.showToast('⚠️ End point must be greater than start point');
      return;
    }

    const formData = new FormData();
    formData.append('file', this.currentItem.rel_path);
    formData.append('start', start);
    formData.append('end', end);
    if (title) formData.append('title', title);

    fetch('api.php?action=save_segment', {
      method: 'POST',
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          VaultUI.showToast('⚠️ Error: ' + (data.error || 'Failed to save segment'));
          return;
        }

        this.currentItem.segments = data.segments || [];
        this.renderVideoSegments();
        this.closeSegmentDrawer();
        
        if (typeof VaultUI !== 'undefined') {
          VaultUI.syncItemSegments(this.currentItem.rel_path, data.segments);
        }

        VaultUI.showToast(`⭐ Segment "${data.segment.title}" saved!`);
      })
      .catch(err => {
        console.error('Save segment error:', err);
        VaultUI.showToast('⚠️ Failed to save segment');
      });
  },

  deleteSegment: function(segmentId) {
    if (!this.currentItem || !segmentId) return;

    const formData = new FormData();
    formData.append('file', this.currentItem.rel_path);
    formData.append('segment_id', segmentId);

    fetch('api.php?action=delete_segment', {
      method: 'POST',
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          VaultUI.showToast('⚠️ ' + (data.error || 'Delete failed'));
          return;
        }

        this.currentItem.segments = data.segments || [];
        if (this.currentSegment && this.currentSegment.id === segmentId) {
          this.currentSegment = null;
        }
        this.renderVideoSegments();

        if (typeof VaultUI !== 'undefined') {
          VaultUI.syncItemSegments(this.currentItem.rel_path, data.segments);
        }

        VaultUI.showToast('Segment removed');
      })
      .catch(err => console.error('Delete segment error:', err));
  },

  playSegment: function(seg, loop = false) {
    if (!this.video || !seg) return;
    this.currentSegment = seg;
    this.isLoopingSegment = loop;

    this.video.currentTime = seg.start;
    this.video.play().catch(() => {});

    // Update active highlight on chips
    document.querySelectorAll('.segment-chip').forEach(c => c.classList.remove('active-clip'));
    const activeChip = document.querySelector(`.segment-chip[data-seg-id="${seg.id}"]`);
    if (activeChip) {
      activeChip.classList.add('active-clip');
      const loopBtn = activeChip.querySelector('.chip-loop-btn');
      if (loopBtn) loopBtn.classList.toggle('active', loop);
    }

    VaultUI.showToast(`▶ Playing segment: "${seg.title}" (${seg.start_formatted} ➔ ${seg.end_formatted})${loop ? ' [Loop ON]' : ''}`);
  },

  renderVideoSegments: function() {
    const section = document.getElementById('videoSegmentsSection');
    const countEl = document.getElementById('videoSegmentsCount');
    const list = document.getElementById('videoSegmentsList');
    if (!section || !list) return;

    const segments = (this.currentItem && this.currentItem.segments) ? this.currentItem.segments : [];

    if (segments.length === 0) {
      section.classList.remove('has-segments');
      return;
    }

    section.classList.add('has-segments');
    if (countEl) countEl.textContent = segments.length;
    list.innerHTML = '';

    segments.forEach(seg => {
      const chip = document.createElement('div');
      const isActive = (this.currentSegment && this.currentSegment.id === seg.id);
      chip.className = `segment-chip ${isActive ? 'active-clip' : ''}`;
      chip.setAttribute('data-seg-id', seg.id);

      chip.innerHTML = `
        <span class="chip-title" title="${seg.title}">${seg.title}</span>
        <span class="chip-range">${seg.start_formatted} ➔ ${seg.end_formatted}</span>
        <button type="button" class="chip-play-btn" title="Jump straight into this segment">▶ Jump</button>
        <button type="button" class="chip-loop-btn ${isActive && this.isLoopingSegment ? 'active' : ''}" title="Repeat this segment in a loop">🔂 Loop</button>
        <button type="button" class="chip-del-btn" title="Delete segment">&times;</button>
      `;

      chip.querySelector('.chip-play-btn').onclick = (e) => {
        e.stopPropagation();
        this.playSegment(seg, false);
      };

      chip.querySelector('.chip-loop-btn').onclick = (e) => {
        e.stopPropagation();
        const shouldLoop = !(this.currentSegment && this.currentSegment.id === seg.id && this.isLoopingSegment);
        this.playSegment(seg, shouldLoop);
      };

      chip.querySelector('.chip-del-btn').onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Delete saved segment "${seg.title}"?`)) {
          this.deleteSegment(seg.id);
        }
      };

      list.appendChild(chip);
    });
  },

  formatTime: function(sec) {
    sec = Math.round(sec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
};

// Initialize player when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  VaultPlayer.init();
});

