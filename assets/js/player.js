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
  progressInterval: null,
  nextCountdownTimer: null,

  init: function() {
    this.video = document.getElementById('vaultVideoPlayer');
    this.stage = document.getElementById('playerStage');
    if (!this.video || !this.stage) return;

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

  loadAndPlay: function(item, shouldPlay = true) {
    if (!item) return;
    this.currentItem = item;
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

    // Check resume position
    const resumeBanner = document.getElementById('resumeBanner');
    const resumeText = document.getElementById('resumeText');
    if (resumeBanner) resumeBanner.classList.remove('visible');

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

    // Start playing
    if (shouldPlay) {
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

    // Save progress periodically
    video.addEventListener('timeupdate', () => {
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

  formatTime: function(sec) {
    sec = Math.round(sec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
};

