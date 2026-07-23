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

    // Drag & Drop Positioning State for Editor
    let isDraggingText = false;
    let customXPercent = 50.0;
    let customYPercent = 50.0;

    // Helper: Direct Browser File Download Trigger (Blob based - No New Tab!)
    window.downloadMediaFile = async (url, filename) => {
        try {
            const fullUrl = url.startsWith('http') ? url : window.location.origin + url;
            const response = await fetch(fullUrl);
            if (!response.ok) throw new Error('Fetch failed');
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename || 'video.mp4';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        } catch (err) {
            console.log('Blob download fallback:', err);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || 'video.mp4';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    // Helper: Native Web Share (Mobile / TikTok / Insta / Shorts)
    window.shareMedia = async (url, filename) => {
        const fullUrl = url.startsWith('http') ? url : window.location.origin + url;
        
        if (navigator.share) {
            try {
                if (url.startsWith('blob:')) {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const file = new File([blob], filename || 'edited_video.mp4', { type: 'video/mp4' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            title: 'Auto-Reels Video',
                            text: 'Auto-Reels ile düzenlendi! ⚡',
                            files: [file]
                        });
                        return;
                    }
                }
                
                await navigator.share({
                    title: 'Auto-Reels Video',
                    text: 'Auto-Reels Sosyal Medya İndirici & Düzenleyici ⚡',
                    url: fullUrl
                });
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.log('Mobile share API fallback:', err);
            }
        }

        try {
            await navigator.clipboard.writeText(fullUrl);
            alert('📋 Video bağlantısı panoya kopyalandı! Sosyal medya uygulamanızda doğrudan paylaşabilirsiniz.');
        } catch (e) {
            alert(`Paylaşım Bağlantısı: ${fullUrl}`);
        }
    };

    // Helper: Client-Side Canvas Video Render with Text Overlay & Full Audio & Fast Speed
    async function createClientSideEditedVideo(videoElement, opts) {
        return new Promise(async (resolve) => {
            try {
                let playableSrc = videoElement.src;
                if (playableSrc.startsWith('http')) {
                    try {
                        const res = await fetch(playableSrc);
                        if (res.ok) {
                            const b = await res.blob();
                            playableSrc = URL.createObjectURL(b);
                        }
                    } catch (e) {
                        console.log('Blob convert skip:', e);
                    }
                }

                const v = document.createElement('video');
                v.crossOrigin = 'anonymous';
                v.src = playableSrc;
                v.muted = false;
                v.volume = 0.01;
                
                await new Promise((resPlay) => {
                    v.onloadeddata = resPlay;
                    v.load();
                });

                const canvas = document.createElement('canvas');
                canvas.width = v.videoWidth || 640;
                canvas.height = v.videoHeight || 360;
                const ctx = canvas.getContext('2d');

                const canvasStream = canvas.captureStream(30);
                
                const videoStream = v.captureStream ? v.captureStream() : (v.mozCaptureStream ? v.mozCaptureStream() : null);
                const tracks = [...canvasStream.getVideoTracks()];
                if (videoStream && videoStream.getAudioTracks().length > 0) {
                    tracks.push(videoStream.getAudioTracks()[0]);
                }

                const combinedStream = new MediaStream(tracks);

                let mimeType = 'video/webm;codecs=vp9';
                if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

                const mediaRecorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 3000000 });
                const chunks = [];

                mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
                mediaRecorder.onstop = () => {
                    const blob = new Blob(chunks, { type: mimeType });
                    const blobUrl = URL.createObjectURL(blob);
                    resolve(blobUrl);
                };

                v.currentTime = 0;
                v.playbackRate = 1.0;
                await v.play();
                mediaRecorder.start();

                const drawFrame = () => {
                    if (v.paused || v.ended) {
                        mediaRecorder.stop();
                        return;
                    }
                    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);

                    // Text styling
                    const fontSize = (opts.fontSize / 40) * (canvas.height * 0.05);
                    ctx.font = `bold ${fontSize}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    let x = canvas.width / 2;
                    let y = canvas.height * 0.82;
                    if (opts.position === 'top') y = canvas.height * 0.12;
                    else if (opts.position === 'center') y = canvas.height * 0.5;
                    else if (opts.position === 'custom') {
                        x = (canvas.width * opts.xPercent) / 100;
                        y = (canvas.height * opts.yPercent) / 100;
                    }

                    const metrics = ctx.measureText(opts.text);
                    const padX = fontSize * 0.4;
                    const padY = fontSize * 0.3;

                    // Box Background
                    if (opts.bgColor === 'black') {
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                        ctx.fillRect(x - metrics.width/2 - padX, y - fontSize/2 - padY, metrics.width + padX*2, fontSize + padY*2);
                    } else if (opts.bgColor === 'white') {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                        ctx.fillRect(x - metrics.width/2 - padX, y - fontSize/2 - padY, metrics.width + padX*2, fontSize + padY*2);
                    } else if (opts.bgColor === 'yellow') {
                        ctx.fillStyle = 'rgba(255, 230, 0, 0.95)';
                        ctx.fillRect(x - metrics.width/2 - padX, y - fontSize/2 - padY, metrics.width + padX*2, fontSize + padY*2);
                    }

                    // Text color
                    if (opts.color === 'black') ctx.fillStyle = '#000000';
                    else if (opts.color === 'yellow') ctx.fillStyle = '#ffe600';
                    else if (opts.color === 'red') ctx.fillStyle = '#ff3b30';
                    else if (opts.color === 'cyan') ctx.fillStyle = '#00f2fe';
                    else ctx.fillStyle = (opts.bgColor === 'white' || opts.bgColor === 'yellow') ? '#000000' : '#ffffff';

                    ctx.fillText(opts.text, x, y);
                    requestAnimationFrame(drawFrame);
                };

                drawFrame();
            } catch (err) {
                console.error('Client side canvas video edit error:', err);
                resolve(videoElement.src);
            }
        });
    }

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
            let finalMediaUrl = '';
            let finalFilename = '';

            if (isLocalhost) {
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
                    finalMediaUrl = `/media/${dlData.filename}`;
                    finalFilename = dlData.filename;
                    loadGallery();
                } else {
                    throw new Error(dlData.detail || 'İndirme hatası oluştu.');
                }
            } else {
                const webInfo = await extractWebVideo(url, platform);
                statusTitle.textContent = webInfo.title;
                statusUploader.textContent = webInfo.uploader;
                if (webInfo.thumbnail) statusThumb.src = webInfo.thumbnail;

                progressFill.style.width = '100%';
                progressPercent.textContent = '100%';
                statusText.innerHTML = '<i class="fa-solid fa-check"></i> Video Hazır!';

                finalMediaUrl = webInfo.video_url;
                finalFilename = `${platform}_${Date.now()}.${selectedFormat}`;

                const fileObj = {
                    filename: finalFilename,
                    media_url: finalMediaUrl,
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
                                ${!isAudio ? `<button class="btn-action btn-edit" onclick="openEditor('${f.media_url}', '${f.filename}')" title="Yazı Ekle / Düzenle"><i class="fa-solid fa-pen-to-square"></i> Düzenle</button>` : ''}
                                <button class="btn-action btn-share" onclick="shareMedia('${f.media_url}', '${f.filename}')" title="Paylaş (TikTok/Insta/Shorts)"><i class="fa-solid fa-share-nodes"></i> Paylaş</button>
                                <button class="btn-action btn-dl" onclick="downloadMediaFile('${f.media_url}', '${f.filename}')" title="Cihaza İndir"><i class="fa-solid fa-download"></i> İndir</button>
                                <button class="btn-action btn-del" onclick="deleteFile('${f.filename}')" title="Sil"><i class="fa-solid fa-trash-can"></i></button>
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
    const editorPreviewContainer = document.querySelector('.editor-preview-container');
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
        customXPercent = 50.0;
        customYPercent = 50.0;
        syncEditorPreview();
        editorModal.style.display = 'flex';
    };

    btnCloseEditor.addEventListener('click', () => {
        editorModal.style.display = 'none';
        editorVideoPreview.pause();
    });

    // Drag & Drop positioning logic for text overlay (Mouse + Touch)
    function handleDragMove(clientX, clientY) {
        if (!editorPreviewContainer) return;
        const rect = editorPreviewContainer.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        customXPercent = Math.max(5, Math.min(95, (x / rect.width) * 100));
        customYPercent = Math.max(5, Math.min(95, (y / rect.height) * 100));

        const customRadio = document.querySelector('input[name="editorPos"][value="custom"]');
        if (customRadio) {
            customRadio.checked = true;
            document.querySelectorAll('.pos-options label').forEach(l => l.classList.remove('active'));
            customRadio.parentElement.classList.add('active');
        }

        syncEditorPreview();
    }

    function startDrag(e) {
        isDraggingText = true;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        handleDragMove(clientX, clientY);
    }

    if (editorOverlayText && editorPreviewContainer) {
        editorOverlayText.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startDrag(e);
        });
        editorOverlayText.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            startDrag(e);
        }, { passive: true });

        editorPreviewContainer.addEventListener('mousedown', (e) => {
            if (e.target !== editorVideoPreview && e.target !== editorPreviewContainer && e.target !== editorOverlayText) return;
            startDrag(e);
        });

        editorPreviewContainer.addEventListener('touchstart', (e) => {
            startDrag(e);
        }, { passive: true });

        document.addEventListener('mousemove', (e) => {
            if (isDraggingText) {
                handleDragMove(e.clientX, e.clientY);
            }
        });

        document.addEventListener('touchmove', (e) => {
            if (isDraggingText && e.touches.length > 0) {
                handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });

        document.addEventListener('mouseup', () => { isDraggingText = false; });
        document.addEventListener('touchend', () => { isDraggingText = false; });
    }

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

        editorOverlayText.style.bottom = 'auto';

        if (pos === 'custom') {
            editorOverlayText.className = `overlay-text pos-custom bg-${bg}`;
            editorOverlayText.style.left = `${customXPercent}%`;
            editorOverlayText.style.top = `${customYPercent}%`;
        } else {
            editorOverlayText.className = `overlay-text pos-${pos} bg-${bg}`;
            editorOverlayText.style.left = '';
            editorOverlayText.style.top = '';
            editorOverlayText.style.bottom = '';
        }

        if (color === 'black') editorOverlayText.style.color = '#000000';
        else if (color === 'yellow') editorOverlayText.style.color = '#ffe600';
        else if (color === 'red') editorOverlayText.style.color = '#ff3b30';
        else if (color === 'cyan') editorOverlayText.style.color = '#00f2fe';
        else editorOverlayText.style.color = (bg === 'white' || bg === 'yellow') ? '#000' : '#fff';
    }

    editorTextInput.addEventListener('input', syncEditorPreview);
    editorSizeInput.addEventListener('input', syncEditorPreview);

    document.querySelectorAll('input[name="editorColor"], input[name="editorBg"], input[name="editorPos"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                if (customXPercent === 50 && customYPercent === 50) {
                    customXPercent = 50;
                    customYPercent = 50;
                }
            }
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
            let editedUrl = '';
            let editedFilename = `edited_${currentEditingFilename}`;

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
                        position,
                        x_percent: customXPercent,
                        y_percent: customYPercent
                    })
                });

                const data = await res.json();
                if (data.success) {
                    editedUrl = data.media_url;
                    editedFilename = data.filename;
                } else {
                    throw new Error(data.detail || 'Video düzenleme hatası');
                }
            } else {
                editedUrl = await createClientSideEditedVideo(editorVideoPreview, {
                    text,
                    fontSize,
                    color,
                    bgColor: bg_color,
                    position,
                    xPercent: customXPercent,
                    yPercent: customYPercent
                });

                const newItem = {
                    filename: editedFilename,
                    media_url: editedUrl,
                    size_mb: 'HD',
                    ext: 'webm',
                    platform: 'edited',
                    created_at: Date.now() / 1000
                };
                saveWebGalleryItem(newItem);
            }

            alert('Video üzerine yazı başarıyla eklendi ve galerinize kaydedildi! 🎉');

            editorModal.style.display = 'none';
            editorVideoPreview.pause();
            loadGallery();
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
