/**
 * Thumbnail Generator & Media Helper
 * Generates client-side video frame thumbnails via HTML5 Canvas and uploads to server cache.
 */
const ThumbGen = {
  queue: [],
  processing: false,
  cache: {},

  // Enqueue a video for thumbnail capture
  queueThumbnail: function(videoItem, imgElement) {
    if (!videoItem || videoItem.type !== 'video') return;
    
    // Check local memory cache
    if (this.cache[videoItem.rel_path]) {
      if (imgElement) imgElement.src = this.cache[videoItem.rel_path];
      return;
    }

    this.queue.push({ item: videoItem, img: imgElement });
    this.processNext();
  },

  processNext: function() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const task = this.queue.shift();
    const item = task.item;
    const imgElement = task.img;

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    video.src = item.stream_url;

    let timeout = setTimeout(() => {
      cleanup();
      ThumbGen.processing = false;
      ThumbGen.processNext();
    }, 12000);

    const cleanup = () => {
      clearTimeout(timeout);
      video.removeAttribute('src');
      video.load();
    };

    video.addEventListener('loadedmetadata', function() {
      // Seek to 10% into video or 3 seconds
      let targetTime = 3;
      if (video.duration > 0) {
        targetTime = Math.min(Math.max(video.duration * 0.15, 1), 60);
      }
      video.currentTime = targetTime;
    });

    video.addEventListener('seeked', function() {
      try {
        const canvas = document.createElement('canvas');
        const width = 480;
        const height = (video.videoHeight / video.videoWidth) * width || 270;
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        ThumbGen.cache[item.rel_path] = dataUrl;

        if (imgElement) {
          imgElement.src = dataUrl;
        }

        // Save to server thumbnail cache in background
        ThumbGen.saveToServer(item.rel_path, dataUrl);

        // Also if item duration was unknown, save detected duration to server
        if ((!item.duration || item.duration === 0) && video.duration > 0) {
          ThumbGen.saveDuration(item.rel_path, video.duration);
        }
      } catch (e) {
        console.warn('Canvas export failed:', e);
      } finally {
        cleanup();
        ThumbGen.processing = false;
        ThumbGen.processNext();
      }
    });

    video.addEventListener('error', function() {
      cleanup();
      ThumbGen.processing = false;
      ThumbGen.processNext();
    });
  },

  // Save generated thumbnail to server
  saveToServer: function(relPath, base64Data) {
    const formData = new FormData();
    formData.append('file', relPath);
    formData.append('image', base64Data);

    fetch('thumb.php?action=save', {
      method: 'POST',
      body: formData
    }).catch(err => console.log('Thumbnail save ignored:', err));
  },

  // Save detected duration
  saveDuration: function(relPath, duration) {
    const formData = new FormData();
    formData.append('file', relPath);
    formData.append('duration', duration);

    fetch('api.php?action=save_duration', {
      method: 'POST',
      body: formData
    }).catch(err => console.log('Duration save ignored:', err));
  },

  // Snapshot current frame of active video player
  capturePlayerFrame: function(videoEl, filename, asThumbnail = false) {
    if (!videoEl || videoEl.videoWidth === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    if (asThumbnail) {
      this.saveToServer(filename, dataUrl);
      this.cache[filename] = dataUrl;
    }

    return dataUrl;
  }
};

