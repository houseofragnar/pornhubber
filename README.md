# 🎬 Private Media Vault

> A sleek, high-performance, self-hosted personal video player and media vault designed to stream and organize video and photo collections directly from local folders or external storage drives.

![PHP](https://img.shields.io/badge/PHP-5.6%20--%208.x-777BB4?style=flat-square&logo=php&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![CSS3](https://img.shields.io/badge/Style-Modern%20Dark%20Theme-181822?style=flat-square)
![Dependencies](https://img.shields.io/badge/Dependencies-Zero-success?style=flat-square)
![Privacy](https://img.shields.io/badge/Privacy-100%25%20Offline%20%2F%20Local-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## ✨ Highlights

- **⚡ Instant Seeking (HTTP 206 Byte-Range Streaming)**: Hardware-accelerated partial content streaming allows instant scrubbing forward and backward across multi-gigabyte video files with zero buffering delay.
- **🔌 External Drive Health & Auto-Detection**: Built specifically to support external HDDs, SSDs, and USB flash drives. Automatically monitors drive mount status, prevents read crashes, and auto-detects USB re-connection every 3 seconds without needing a page refresh.
- **🔀 Drive Letter Shift Detection**: If Windows re-assigns your drive from `D:` to `E:` or `F:`, the app automatically scans mounted drives and notifies you of the target folder's new location.
- **⏱️ Smart Resume Playback**: Remembers your exact watch timestamp positions and prompts you with a quick one-click resume banner when returning to a video.
- **📸 High-Resolution Frame Snapshots**: Capture clean video frame screenshots at native resolution with one click (<kbd>S</kbd>) to download or set as custom poster thumbnails.
- **🖼️ Client-Side Canvas Thumbnails**: Automatically extracts video poster frames locally using the HTML5 Canvas API and caches them on disk—no `ffmpeg` installation required!
- **🎦 Theater Mode, Fullscreen & PiP**: Easily toggle between standard layout, ultra-wide theater mode (<kbd>T</kbd>), picture-in-picture floating overlay (<kbd>P</kbd>), and native fullscreen (<kbd>F</kbd>).
- **⏩ Speed & Repeat Controls**: Fine-grained playback speed selector (`0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`, `2.0x`) and single-video repeat toggle (<kbd>R</kbd>).
- **⏭️ Auto-Next Queue**: Automatically queues and transitions to subsequent media in your filtered list.
- **🎲 "Surprise Me" Shuffle**: Instantly picks and plays a random video from your library.
- **📷 Integrated Photo Lightbox**: Built-in viewer for high-resolution photo galleries with previous/next navigation.
- **🔍 Real-Time Search & Filtering**: Instant title/filename search and quick filter tabs for Videos, Photos, Favorites, and Playlists.
- **📱 Responsive & Mobile-Friendly**: Fully responsive dark theme that works smoothly on desktop monitors, laptops, tablets, and smartphones over local Wi-Fi.
- **🔒 100% Private & Local**: Zero external tracking, zero analytics, zero cloud dependencies, and zero cookies. Your media stays strictly on your machine.

---

## 🚀 Quick Start Guide

### Prerequisites
- Any web server environment with PHP 5.6, 7.x, or 8.x:
  - **Windows**: [XAMPP](https://www.apachefriends.org/), [Laragon](https://laragon.org/), or [WampServer](https://www.wampserver.com/)
  - **Linux / macOS**: Apache, Nginx, or PHP CLI (`php -S`)

---

### Installation Steps

#### 1. Clone or Download the Repository
Clone this repository into your web server's document root (e.g., `C:/xampp/htdocs/xxx` or `/var/www/html/xxx`):

```bash
git clone https://github.com/yourusername/private-media-vault.git xxx
cd xxx
```

#### 2. Configure Your Media Folder
Copy `config.example.php` to `config.php` (if not already created) and open `config.php`:

```php
// Physical directory containing your video and photo files:
define('MEDIA_DIR', 'D:\\os\\chi\\Best'); // Set to your folder path
```

> **Note for Windows Users:** Use double backslashes in paths, e.g., `'D:\\Media\\Videos'`.  
> **Note for Linux / macOS Users:** Use forward slashes, e.g., `'/media/user/ExternalDrive/Videos'`.

#### 3. (Recommended for Windows Apache) Create a Directory Junction
To allow Apache to stream multi-gigabyte video files directly with maximum zero-copy performance, create a directory junction pointing `media` to your external folder:

Open **Command Prompt** (CMD) as Administrator or normal user:
```cmd
mklink /J "C:\xampp\htdocs\xxx\media" "D:\os\chi\Best"
```

*(If you don't create a junction, the app includes a built-in fallback streaming handler via `stream.php` that works out of the box).*

#### 4. Launch the App
Open your web browser and visit:
👉 **`http://localhost/xxx/`**

---

### Alternative: Running with PHP Built-in Web Server
If you don't have XAMPP or Apache installed, you can launch it directly with PHP from terminal/PowerShell:

```bash
cd xxx
php -S localhost:8080
```
Then visit **`http://localhost:8080/`**.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| <kbd>Space</kbd> or <kbd>K</kbd> | Play / Pause |
| <kbd>◀</kbd> or <kbd>J</kbd> | Seek Backward 10 seconds |
| <kbd>▶</kbd> or <kbd>L</kbd> | Seek Forward 10 seconds |
| <kbd>▲</kbd> / <kbd>▼</kbd> | Volume Up / Down (10% increments) |
| <kbd>M</kbd> | Mute / Unmute audio |
| <kbd>F</kbd> | Toggle Fullscreen |
| <kbd>T</kbd> | Toggle Wide Theater Mode |
| <kbd>P</kbd> | Toggle Picture-in-Picture (PiP) |
| <kbd>S</kbd> | Capture High-Res Snapshot & Update Thumbnail |
| <kbd>R</kbd> | Toggle Repeat / Loop Current Video |
| <kbd>[</kbd> / <kbd>]</kbd> | Play Previous / Next Video in Queue |
| <kbd>?</kbd> | Open Keyboard Shortcuts Modal |

---

## 📱 Accessing from Your Phone or Tablet

To watch videos on your smartphone or tablet connected to the same local Wi-Fi:

1. Check your computer's local IP address (e.g., `192.168.1.100` or `10.86.42.164`).
2. Open your mobile browser and enter:
   ```
   http://YOUR_LOCAL_IP/xxx/
   ```
3. The responsive mobile interface will load with touch-friendly controls.

---

## 📁 Project Architecture

```
├── assets/
│   ├── css/
│   │   └── app.css         # Modern responsive dark theme styling
│   └── js/
│       ├── app.js          # Library browsing, filters, search & drive polling
│       ├── player.js       # Video player controller & keyboard shortcut engine
│       └── thumb.js        # Canvas-based video thumbnail generator
├── data/
│   ├── metadata.json       # User preferences, favorites & resume progress
│   └── thumbnails/         # Cached video poster images
├── api.php                 # JSON REST API for media listings and drive health checks
├── config.php              # Storage paths, allowed extensions, and drive detection
├── config.example.php      # Configuration template for new installations
├── index.php               # Single-page web application & theater player stage
├── stream.php              # Fallback video streamer with HTTP 206 Partial Content
├── thumb.php               # Thumbnail server and GD image resizer
└── .gitignore              # Protects private user data and media links
```

---

## 📂 Supported File Formats

- **Videos**: `.mp4`, `.mov`, `.webm`, `.mkv`, `.m4v`, `.avi`, `.wmv`, `.flv`, `.ts`, `.3gp`
- **Photos / Images**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`
- **Playlists**: `.xspf` (VLC playlist parser included), `.m3u`, `.m3u8`

---

## 🛠️ Configuration Details (`config.php`)

| Constant | Description | Default |
| :--- | :--- | :--- |
| `MEDIA_DIR` | Physical path to your media directory or external drive | `'D:\\os\\chi\\Best'` |
| `APP_NAME` | Display title shown in the header and browser tab | `'Private Media Vault'` |
| `MEDIA_WEB_PATH`| Web-accessible path for direct Apache streaming | `'media'` |
| `$VIDEO_EXTS` | Array of recognized video file extensions | `['mp4', 'mov', 'webm', ...]` |
| `$IMAGE_EXTS` | Array of recognized image file extensions | `['jpg', 'jpeg', 'png', ...]` |

---

## 🔒 Privacy & Security

- **Zero Cloud Communication**: The app runs completely offline. No data, telemetry, or file listings are transmitted across the internet.
- **Path Sanitization**: `stream.php` and `api.php` enforce directory traversal protection (`basename` and `realpath` validation) to prevent accessing files outside your chosen directory.
- **Git Protected**: The included `.gitignore` ensures your personal watch progress (`metadata.json`), generated thumbnails, and local directory junctions are never committed to version control.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — free to use and customize for personal use.

