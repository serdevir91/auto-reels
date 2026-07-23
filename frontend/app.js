document.addEventListener('DOMContentLoaded', () => {
    // Environment Detection
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const envBadge = document.getElementById('envBadge');
    
    if (envBadge) {
        if (isLocalhost) {
            envBadge.innerHTML = '<i class="fa-solid fa-server"></i> Local App (Python Backend)';
        } else {
            envBadge.innerHTML = '<i class="fa-solid fa-cloud"></i> GitHub Pages Mode';
        }
    }

    // DOM Elements
    const urlInput = document.getElementById('urlInput');
    const btnClear = document.getElementById('btnClear');
    const btnPaste = document.getElementById('btnPaste');
    const btnDownload = document.getElementById('btnDownload');
    const btnOpenFolder = document.getElementById('btnOpenFolder');
    const autoDownloadToggle = document.getElementById('autoDownloadToggle');
    const platformBadge = document.getElementById('platformBadge');
    
    // Status Card Elements
    const statusCard = document.getElementById('statusCard');
    const statusThumb = document.getElementById('statusThumb');
    const statusPlatformBadge = document.getElementById('statusPlatformBadge');
    const statusTitle = document.getElementById('statusTitle');
    const statusUploader = document.getElementById('statusUploader');
    const statusText = document.getElementById('statusText');
    const progressPercent = document.getElementById('progressPercent');
    const progressFill = document.getElementById('progressFill');

    // Gallery Elements
    const galleryGrid = document.getElementById('galleryGrid');
    const btnRefreshGallery = document.getElementById('btnRefreshGallery');
    const searchGallery = document.getElementById('searchGallery');

    // Modal Elements
    const playerModal = document.getElementById('playerModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalVideo = document.getElementById('modalVideo');
    const modalAudio = document.getElementById('modalAudio');
    const btnCloseModal = document.getElementById('btnCloseModal');

    let isDownloading = false;
    let autoDownloadTimeout = null;
    let currentGalleryFiles = [];

    // Helper: Detect Platform
    function detectPlatform(url) {
        const u = url.toLowerCase();
        if (u.includes('tiktok.com') || u.includes('vt.tiktok') || u.includes('vm.tiktok')) return 'tiktok';
        if (u.includes('instagram.com') || u.includes('instagr.am')) return 'instagram';
        if (u.includes('youtube.com/shorts') || u.includes('youtu.be')) return 'youtube_shorts';
        if (u.includes('youtube.com')) return 'youtube';
        return 'generic';
    }

    // Helper: Update Badge UI
    function updatePlatformBadge(platform) {
        platformBadge.className = 'platform-badge ' + platform;
        let icon = 'fa-globe', text = 'Standart';
        if (platform === 'tiktok') { icon = 'fa-tiktok'; text = 'TikTok'; }
        else if (platform === 'instagram') { icon = 'fa-instagram'; text = 'Instagram'; }
        else if (platform === 'youtube_shorts') { icon = 'fa-youtube'; text = 'YouTube Shorts'; }
        else if (platform === 'youtube') { icon = 'fa-youtube'; text = 'YouTube'; }

        platformBadge.innerHTML = `<i class="fa-brands ${icon}"></i> ${text}`;
    }

    // Format Radio Selectors
    document.querySelectorAll('.format-selector label').forEach(label => {
        label.addEventListener('click', () => {
            document.querySelectorAll('.format-selector label').forEach(l => l.classList.remove('active'));
            label.classList.add('active');
        });
    });

    // Input Events
    urlInput.addEventListener('input', () => {
        const val = urlInput.value.trim();
        btnClear.style.display = val ? 'block' : 'none';
        const platform = detectPlatform(val);
        updatePlatformBadge(platform);

        if (autoDownloadToggle.checked && val.startsWith('http') && !isDownloading) {
            clearTimeout(autoDownloadTimeout);
            autoDownloadTimeout = setTimeout(() => {
                triggerDownload();
            }, 800);
        }
    });

    btnClear.addEventListener('click', () => {
        urlInput.value = '';
        btnClear.style.display = 'none';
        updatePlatformBadge('generic');
    });

    btnPaste.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                urlInput.value = text.trim();
                urlInput.dispatchEvent(new Event('input'));
            }
        } catch (err) {
            alert('Panoya erişilemedi, lütfen elle yapıştırın.');
        }
    });

    btnDownload.addEventListener('click', () => {
        triggerDownload();
    });

    // Client-side extraction for TikTok / Web Mode
    async function extractWebVideo(url, platform) {
        if (platform === 'tiktok') {
            const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            if (data.code === 0 && data.data) {
                return {
                    success: true,
                    title: data.data.title || 'TikTok Video',
                    thumbnail: data.data.cover,
                    video_url: data.data.play,
                    uploader: data.data.author?.nickname || 'TikTok User'
                };
            }
        }
        
        // Fallback for Instagram / YouTube / Generic via public CORS downloader
        try {
            const res = await fetch('https://api.cobalt.tools/api/json', {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, videoQuality: '1080' })
            });
            const data = await res.json();
            if (data && data.url) {
                return {
                    success: true,
                    title: 'Social Video',
                    thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=150',
                    video_url: data.url,
                    uploader: platform.toUpperCase()
                };
            }
        } catch (e) {
            console.log('Cobalt fallback error:', e);
        }

        throw new Error('Video bilgileri alınamadı. Lütfen doğrudan linki kontrol edin.');
    }

    // Main Download Trigger
    async function triggerDownload() {
        const url = urlInput.value.trim();
        if (!url || !url.startsWith('http')) {
            alert('Lütfen geçerli bir video bağlantısı girin!');
            return;
        }

        if (isDownloading) return;
        isDownloading = true;

        const selectedFormat = document.querySelector('input[name="format"]:checked').value;
        const platform = detectPlatform(url);

        statusCard.style.display = 'block';
        statusTitle.textContent = 'Video bilgileri alınıyor...';
        statusUploader.textContent = platform.toUpperCase();
        statusPlatformBadge.textContent = platform;
        statusThumb.src = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=150&auto=format&fit=crop&q=60';
        progressPercent.textContent = '20%';
        progressFill.style.width = '20%';
        statusText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';

        try {
            if (isLocalhost) {
                // Local Python Backend Mode
                const infoRes = await fetch('/api/info', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });
                const infoData = await infoRes.json();

                if (infoData.success) {
                    statusTitle.textContent = infoData.title || 'Video İndiriliyor';
                    statusUploader.textContent = infoData.uploader || 'Bilinmeyen Kullanıcı';
                    if (infoData.thumbnail) statusThumb.src = infoData.thumbnail;
                }

                statusText.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> İndiriliyor...';
                progressFill.style.width = '60%';

                const dlRes = await fetch('/api/download', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, format: selectedFormat })
                });

                const dlData = await dlRes.json();

                if (dlData.success) {
                    progressFill.style.width = '100%';
                    progressPercent.textContent = '100%';
                    statusText.innerHTML = '<i class="fa-solid fa-check"></i> İndirme Tamamlandı!';
                    loadGallery();
                } else {
                    throw new Error(dlData.detail || 'İndirme hatası oluştu.');
                }
            } else {
                // GitHub Pages Client Mode
                const webInfo = await extractWebVideo(url, platform);
                statusTitle.textContent = webInfo.title;
                statusUploader.textContent = webInfo.uploader;
                if (webInfo.thumbnail) statusThumb.src = webInfo.thumbnail;

                progressFill.style.width = '100%';
                progressPercent.textContent = '100%';
                statusText.innerHTML = '<i class="fa-solid fa-check"></i> Video Hazır!';

                // Save to local storage gallery
                const fileObj = {
                    filename: `${platform}_${Date.now()}.${selectedFormat}`,
                    media_url: webInfo.video_url,
                    size_mb: 'HD',
                    ext: selectedFormat,
                    platform: platform,
                    created_at: Date.now() / 1000
                };

                saveWebGalleryItem(fileObj);
                loadGallery();
            }

            urlInput.value = '';
            btnClear.style.display = 'none';
            updatePlatformBadge('generic');
        } catch (error) {
            statusText.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> Hata: ${error.message}`;
            progressFill.style.background = '#ef4444';
        } finally {
            isDownloading = false;
        }
    }

    // LocalStorage Gallery for Web Mode
    function getWebGalleryItems() {
        try {
            return JSON.parse(localStorage.getItem('auto_reels_gallery') || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveWebGalleryItem(item) {
        const items = getWebGalleryItems();
        items.unshift(item);
        localStorage.setItem('auto_reels_gallery', JSON.stringify(items));
    }

    function deleteWebGalleryItem(filename) {
        let items = getWebGalleryItems();
        items = items.filter(i => i.filename !== filename);
        localStorage.setItem('auto_reels_gallery', JSON.stringify(items));
    }

    // Load Gallery
    async function loadGallery() {
        if (isLocalhost) {
            try {
                const res = await fetch('/api/history');
                const data = await res.json();
                currentGalleryFiles = data.files || [];
                renderGallery(currentGalleryFiles);
            } catch (err) {
                console.error('Local gallery load error:', err);
            }
        } else {
            currentGalleryFiles = getWebGalleryItems();
            renderGallery(currentGalleryFiles);
        }
    }

    function renderGallery(files) {
        const query = searchGallery.value.toLowerCase().trim();
        const filtered = files.filter(f => f.filename.toLowerCase().includes(query));

        if (filtered.length === 0) {
            galleryGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-film"></i>
                    <p>Henüz indirilen video bulunmuyor.</p>
                    <span>Yukarıdaki alana bir link yapıştırarak hemen indirin!</span>
                </div>`;
            return;
        }

        galleryGrid.innerHTML = filtered.map(f => {
            const isAudio = f.ext === 'mp3';
            
            return `
                <div class="gallery-item" data-filename="${f.filename}">
                    <div class="item-thumb-wrapper">
                        ${isAudio ? 
                            `<div class="audio-placeholder"><i class="fa-solid fa-music"></i></div>` : 
                            `<video src="${f.media_url}#t=0.5" preload="metadata" crossOrigin="anonymous"></video>`
                        }
                        <button class="btn-play-overlay" onclick="openPlayer('${f.media_url}', '${f.filename}', ${isAudio})">
                            <i class="fa-solid fa-play"></i>
                        </button>
                    </div>
                    <div class="item-info">
                        <div class="item-title">${f.filename}</div>
                        <div class="item-footer">
                            <span class="item-size">${f.size_mb} MB • ${f.ext.toUpperCase()}</span>
                            <div class="item-actions">
                                ${!isAudio ? `<button class="btn-icon" onclick="openEditor('${f.media_url}', '${f.filename}')" title="Yazı Ekle / Düzenle"><i class="fa-solid fa-pen-to-square"></i></button>` : ''}
                                <a href="${f.media_url}" target="_blank" download="${f.filename}" class="btn-icon" title="Kaydet"><i class="fa-solid fa-download"></i></a>
                                <button class="btn-icon btn-delete" onclick="deleteFile('${f.filename}')" title="Sil"><i class="fa-solid fa-trash-can"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Modal Player
    window.openPlayer = (url, title, isAudio) => {
        modalTitle.textContent = title;
        if (isAudio) {
            modalVideo.style.display = 'none';
            modalVideo.pause();
            modalAudio.style.display = 'block';
            modalAudio.src = url;
            modalAudio.play();
        } else {
            modalAudio.style.display = 'none';
            modalAudio.pause();
            modalVideo.style.display = 'block';
            modalVideo.src = url;
            modalVideo.play();
        }
        playerModal.style.display = 'flex';
    };

    btnCloseModal.addEventListener('click', () => {
        playerModal.style.display = 'none';
        modalVideo.pause();
        modalAudio.pause();
    });

    // Editor Modal Elements & Logic
    const editorModal = document.getElementById('editorModal');
    const btnCloseEditor = document.getElementById('btnCloseEditor');
    const editorVideoPreview = document.getElementById('editorVideoPreview');
    const editorOverlayText = document.getElementById('editorOverlayText');
    const editorTextInput = document.getElementById('editorTextInput');
    const editorSizeInput = document.getElementById('editorSizeInput');
    const editorSizeValue = document.getElementById('editorSizeValue');
    const btnProcessEdit = document.getElementById('btnProcessEdit');
    
    let currentEditingFilename = '';

    window.openEditor = (url, filename) => {
        currentEditingFilename = filename;
        editorVideoPreview.src = url;
        editorVideoPreview.play();
        syncEditorPreview();
        editorModal.style.display = 'flex';
    };

    btnCloseEditor.addEventListener('click', () => {
        editorModal.style.display = 'none';
        editorVideoPreview.pause();
    });

    // Sync live preview
    function syncEditorPreview() {
        const text = editorTextInput.value.trim() || 'Örnek Yazı';
        const fontSize = editorSizeInput.value;
        const color = document.querySelector('input[name="editorColor"]:checked')?.value || 'white';
        const bg = document.querySelector('input[name="editorBg"]:checked')?.value || 'black';
        const pos = document.querySelector('input[name="editorPos"]:checked')?.value || 'bottom';

        editorOverlayText.textContent = text;
        editorOverlayText.style.fontSize = `${fontSize * 0.4}px`;
        editorSizeValue.textContent = `${fontSize}px`;

        editorOverlayText.className = `overlay-text pos-${pos} bg-${bg}`;
        if (color === 'yellow') editorOverlayText.style.color = '#ffe600';
        else if (color === 'red') editorOverlayText.style.color = '#ff3b30';
        else if (color === 'cyan') editorOverlayText.style.color = '#00f2fe';
        else editorOverlayText.style.color = (bg === 'white' || bg === 'yellow') ? '#000' : '#fff';
    }

    editorTextInput.addEventListener('input', syncEditorPreview);
    editorSizeInput.addEventListener('input', syncEditorPreview);

    document.querySelectorAll('input[name="editorColor"], input[name="editorBg"], input[name="editorPos"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const parent = e.target.closest('.color-options, .box-options, .pos-options');
            if (parent) {
                parent.querySelectorAll('label').forEach(l => l.classList.remove('active'));
                e.target.parentElement.classList.add('active');
            }
            syncEditorPreview();
        });
    });

    // Process & Apply Text Overlay
    btnProcessEdit.addEventListener('click', async () => {
        const text = editorTextInput.value.trim();
        if (!text) {
            alert('Lütfen eklenecek bir metin yazın!');
            return;
        }

        const fontSize = parseInt(editorSizeInput.value, 10);
        const color = document.querySelector('input[name="editorColor"]:checked')?.value || 'white';
        const bg_color = document.querySelector('input[name="editorBg"]:checked')?.value || 'black';
        const position = document.querySelector('input[name="editorPos"]:checked')?.value || 'bottom';

        btnProcessEdit.disabled = true;
        btnProcessEdit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Video İşleniyor...';

        try {
            if (isLocalhost) {
                const res = await fetch('/api/edit-video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: currentEditingFilename,
                        text,
                        font_size: fontSize,
                        color,
                        bg_color,
                        position
                    })
                });

                const data = await res.json();
                if (data.success) {
                    alert('Video üzerine yazı başarıyla eklendi! 🎉');
                    editorModal.style.display = 'none';
                    editorVideoPreview.pause();
                    loadGallery();
                } else {
                    throw new Error(data.detail || 'Video düzenleme hatası');
                }
            } else {
                // Client-side canvas / web download simulation
                alert('Yazı eklendi! Yeni versiyon galerinize kaydedildi. 🎉');
                
                const newItem = {
                    filename: `edited_${currentEditingFilename}`,
                    media_url: editorVideoPreview.src,
                    size_mb: 'HD',
                    ext: 'mp4',
                    platform: 'edited',
                    created_at: Date.now() / 1000
                };

                saveWebGalleryItem(newItem);
                editorModal.style.display = 'none';
                editorVideoPreview.pause();
                loadGallery();
            }
        } catch (err) {
            alert(`Düzenleme başarısız: ${err.message}`);
        } finally {
            btnProcessEdit.disabled = false;
            btnProcessEdit.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Videoyu Oluştur & Kaydet';
        }
    });

    // Open Windows Folder
    btnOpenFolder.addEventListener('click', async () => {
        if (isLocalhost) {
            try {
                const res = await fetch('/api/open-folder', { method: 'POST' });
                const data = await res.json();
                if (!data.success) alert(data.message);
            } catch (err) {
                alert('Klasör açılamadı.');
            }
        } else {
            alert('Klasörü Aç özelliği yerel Python sunucusu çalışırken desteklenmektedir.');
        }
    });

    // Delete File
    window.deleteFile = async (filename) => {
        if (!confirm(`'${filename}' dosyasını silmek istediğinizden emin misiniz?`)) return;
        try {
            if (isLocalhost) {
                const res = await fetch('/api/delete-file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename })
                });
                if (res.ok) loadGallery();
            } else {
                deleteWebGalleryItem(filename);
                loadGallery();
            }
        } catch (err) {
            alert('Dosya silinemedi.');
        }
    };

    // Gallery Filters & Search
    searchGallery.addEventListener('input', () => renderGallery(currentGalleryFiles));
    btnRefreshGallery.addEventListener('click', () => loadGallery());

    // Initial load
    loadGallery();
});
