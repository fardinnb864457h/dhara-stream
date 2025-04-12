const { ipcRenderer } = require('electron');

// Wait for DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', () => {
    // Essential DOM Elements
    const searchBar = document.getElementById('searchBar');
    const searchBarMobile = document.getElementById('searchBarMobile');
    const searchButtonMobile = document.getElementById('searchButtonMobile');
    const searchModal = document.getElementById('searchModal');
    const closeSearchModal = document.getElementById('closeSearchModal');
    const loadingChannels = document.getElementById('loadingChannels');
    
    // Player elements
    const playerContainer = document.getElementById('playerContainer');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const playerInfo = document.getElementById('playerInfo');
    const playerActions = document.getElementById('playerActions');
    const ytChannelTitle = document.getElementById('yt-channel-title');
    const ytChannelCategory = document.getElementById('yt-channel-category');
    const ytFavoriteBtn = document.getElementById('yt-favorite-btn');
    const favoritesCarousel = document.getElementById('favoritesCarousel');
    
    // Channel list elements
    const channelList = document.getElementById('channelList');
    const channelListColumn = document.getElementById('channelListColumn');
    const toggleChannelList = document.getElementById('toggleChannelList');
    const overlay = document.getElementById('overlay');
    const channelListTitle = document.querySelector('.channel-list-title');
    
    // Settings elements
    const settingsButton = document.getElementById('settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const jsonUrlInput = document.getElementById('jsonUrlInput');
    const saveSettings = document.getElementById('saveSettings');
    const cancelSettings = document.getElementById('cancelSettings');
    const resetSettings = document.getElementById('resetSettings');
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');
    
    // Default JSON URL - update to point to M3U file
    const DEFAULT_JSON_URL = 'https://raw.githubusercontent.com/byte-capsule/Toffee-Channels-Link-Headers/refs/heads/main/toffee_OTT_Navigator.m3u';
    
    // Get custom URL from localStorage or use default
    const jsonUrl = localStorage.getItem('customJsonUrl') || DEFAULT_JSON_URL;

    // Global variables
    let channels = [];
    let filteredChannels = [];
    let favorites = JSON.parse(localStorage.getItem('favorites')) || {};
    let currentCategory = 'all';
    let currentChannel = null;
    let ytPlayer = null;
    let ytHls = null;

    // Function to show notification
    function showNotification(message, duration = 3000) {
      notificationMessage.textContent = message;
      notification.classList.add('show');
      setTimeout(() => {
        notification.classList.remove('show');
      }, duration);
    }

    // Settings Modal Handlers
    settingsButton.addEventListener('click', () => {
      jsonUrlInput.value = localStorage.getItem('customJsonUrl') || '';
      settingsModal.style.display = 'flex';
    });

    closeSettingsBtn.addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });

    cancelSettings.addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });

    resetSettings.addEventListener('click', () => {
      jsonUrlInput.value = '';
      localStorage.removeItem('customJsonUrl');
      showNotification('Settings reset to default');
    });

    saveSettings.addEventListener('click', () => {
      const customUrl = jsonUrlInput.value.trim();
      
      if (customUrl) {
        localStorage.setItem('customJsonUrl', customUrl);
        showNotification('Settings saved! Reloading channels...');
      } else {
        localStorage.removeItem('customJsonUrl');
        showNotification('Using default channel source');
      }
      
      settingsModal.style.display = 'none';
      
      // Reload channels with new URL
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    });

    // Mobile search functionality
    searchButtonMobile.addEventListener('click', () => {
      searchModal.classList.add('show');
      searchBarMobile.focus();
    });

    closeSearchModal.addEventListener('click', () => {
      searchModal.classList.remove('show');
    });

    // Toggle channel list for mobile
    toggleChannelList.addEventListener('click', () => {
      channelListColumn.classList.toggle('show');
      overlay.classList.toggle('show');
    });

    overlay.addEventListener('click', () => {
      channelListColumn.classList.remove('show');
      overlay.classList.remove('show');
    });

    // Create sidebar category tabs - simplified
    function createCategoryTabs() {
      const sidebarCategoryTabs = document.getElementById('sidebarCategoryTabs');
      sidebarCategoryTabs.innerHTML = '';
      
      // Add All category tab
      const allTab = document.createElement('button');
      allTab.className = 'sidebar-category-tab';
      if (currentCategory === 'all') allTab.classList.add('active');
      allTab.textContent = 'All';
      allTab.setAttribute('data-category', 'all');
      allTab.addEventListener('click', () => filterChannelsByCategory('all'));
      sidebarCategoryTabs.appendChild(allTab);
      
      // Get unique categories and add tabs
      const uniqueCategories = [...new Set(channels
        .map(channel => channel.category && channel.category.toLowerCase())
        .filter(Boolean))];
      
      uniqueCategories.forEach(category => {
        const channelWithCategory = channels.find(ch => ch.category && ch.category.toLowerCase() === category);
        const displayName = channelWithCategory ? channelWithCategory.category : category;
        
        const categoryTab = document.createElement('button');
        categoryTab.className = 'sidebar-category-tab';
        if (currentCategory === category) categoryTab.classList.add('active');
        categoryTab.textContent = displayName;
        categoryTab.setAttribute('data-category', category);
        categoryTab.addEventListener('click', () => filterChannelsByCategory(category));
        sidebarCategoryTabs.appendChild(categoryTab);
      });
    }

    // Function to filter channels by category - simplified
    function filterChannelsByCategory(category) {
      currentCategory = category;
      
      document.querySelectorAll('.sidebar-category-tab').forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-category') === category);
      });
      
      if (category === 'all') {
        filteredChannels = channels;
        channelListTitle.textContent = 'All Channels';
      } else {
        filteredChannels = channels.filter(channel => 
          channel.category && channel.category.toLowerCase() === category.toLowerCase()
        );
        channelListTitle.textContent = `${filteredChannels.length > 0 ? filteredChannels[0].category : category} Channels`;
      }
      
      renderChannelList();
    }

    // Function to create a channel item
    function createChannelItem(channel) {
      const item = document.createElement('div');
      item.className = 'channel-item';
      if (currentChannel && currentChannel.name === channel.name) {
        item.classList.add('active');
      }
      
      item.innerHTML = `
        <div class="channel-thumb">
          <img src="${channel.logo}" alt="${channel.name}" onerror="this.src='icon.png';">
        </div>
        <div class="channel-info">
          <div class="channel-name">${channel.name}</div>
          <div class="channel-category">${channel.category || 'Channel'}</div>
        </div>
      `;
      
      item.addEventListener('click', () => {
        playChannel(channel);
        
        document.querySelectorAll('.channel-item').forEach(ch => ch.classList.remove('active'));
        item.classList.add('active');
        
        if (window.innerWidth <= 900) {
          channelListColumn.classList.remove('show');
          overlay.classList.remove('show');
        }
      });
      
      return item;
    }

    // Function to toggle favorite status
    function toggleFavorite(channelId) {
      favorites[channelId] = !favorites[channelId];
      
      if (!favorites[channelId]) {
        delete favorites[channelId];
      }
      
      localStorage.setItem('favorites', JSON.stringify(favorites));
      
      loadFavoritesCarousel();
    }

    // Function to render channel list - simplified
    function renderChannelList(searchQuery = '') {
      channelList.innerHTML = '';
      channelList.appendChild(loadingChannels);
      loadingChannels.style.display = 'none';
      
      let displayChannels = filteredChannels;
      
      if (searchQuery) {
        displayChannels = displayChannels.filter(channel => 
          channel.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      if (displayChannels.length === 0) {
        channelList.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-tv empty-icon"></i>
            <h3 class="empty-title">No channels found</h3>
            <p class="empty-subtitle">Try searching for something else or check your connection</p>
          </div>
        `;
      } else {
        displayChannels.forEach(channel => {
          channelList.appendChild(createChannelItem(channel));
        });
      }
    }

    // Function to play a channel
    function playChannel(channel) {
      currentChannel = channel;
      
      welcomeScreen.style.display = 'none';
      playerContainer.style.display = 'block';
      playerInfo.style.display = 'block';
      playerActions.style.display = 'flex';
      
      ytChannelTitle.textContent = channel.name;
      ytChannelCategory.textContent = channel.category || 'Live TV';
      
      const isFavorite = favorites[channel.name] || false;
      ytFavoriteBtn.innerHTML = `
        <i class="fa-${isFavorite ? 'solid' : 'regular'} fa-heart"></i>
        <span>${isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</span>
      `;
      ytFavoriteBtn.classList.toggle('active', isFavorite);
      
      const { link: streamUrl, userAgent, cookie } = channel;
      
      if (ytHls) {
        ytHls.destroy();
        ytHls = null;
      }
      
      if (ytPlayer) {
        ytPlayer.destroy();
        ytPlayer = null;
      }
      
      document.getElementById('youtubeStylePlayer').innerHTML = '';
      
      const video = document.createElement('video');
      video.id = 'ytVideoPlayer';
      video.style.width = '100%';
      video.style.height = '100%';
      document.getElementById('youtubeStylePlayer').appendChild(video);
      
      ytPlayer = new Plyr(video, {
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'pip', 'settings', 'fullscreen'],
        fullscreen: { enabled: true, iosNative: true },
        autoplay: true,
      });
      
      ipcRenderer.send('set-headers', { userAgent, cookie });
      
      ipcRenderer.once('headers-set', () => {
        if (Hls.isSupported()) {
          ytHls = new Hls({
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            liveSyncDuration: 3,
            liveMaxLatencyDuration: 10,
            lowLatencyMode: true,
            backBufferLength: 30
          });
          
          ytHls.loadSource(streamUrl);
          ytHls.attachMedia(video);
          
          ytHls.on(Hls.Events.MANIFEST_PARSED, () => {
            ytPlayer.play().catch(error => {
              console.error('Error playing video:', error);
              showNotification('Failed to play video. Please try again.');
            });
          });
          
          ytHls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  showNotification('Network error. Attempting to reconnect...');
                  ytHls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  showNotification('Media error. Attempting to recover...');
                  ytHls.recoverMediaError();
                  break;
                default:
                  showNotification('Failed to play this channel. Please try another one.');
                  ytHls.destroy();
                  break;
              }
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = streamUrl;
          video.addEventListener('loadedmetadata', () => {
            ytPlayer.play().catch(error => {
              console.error('Error playing video:', error);
              showNotification('Failed to play video. Please try again.');
            });
          });
        } else {
          showNotification('HLS playback is not supported in your browser.');
        }
      });
    }
    
    // Load favorites carousel - simplified
    function loadFavoritesCarousel() {
      favoritesCarousel.innerHTML = '';
      
      const favoriteChannels = channels.filter(channel => favorites[channel.name]);
      
      if (favoriteChannels.length === 0) {
        favoritesCarousel.innerHTML = `
          <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
            You haven't added any favorites yet. Click the heart button to add channels to your favorites.
          </div>
        `;
        return;
      }
      
      favoriteChannels.forEach(channel => {
        const item = document.createElement('div');
        item.className = 'carousel-item';
        item.innerHTML = `
          <div class="carousel-thumb">
            <img src="${channel.logo}" alt="${channel.name}" onerror="this.src='icon.png';">
          </div>
          <div class="carousel-name">${channel.name}</div>
        `;
        
        item.addEventListener('click', () => {
          playChannel(channel);
          
          document.querySelectorAll('.channel-item').forEach(ch => ch.classList.remove('active'));
          const activeItem = Array.from(document.querySelectorAll('.channel-item')).find(
            item => item.querySelector('.channel-name').textContent === channel.name
          );
          if (activeItem) activeItem.classList.add('active');
        });
        
        favoritesCarousel.appendChild(item);
      });
    }
    
    // Add event listener to favorite button
    ytFavoriteBtn.addEventListener('click', () => {
      if (!currentChannel) return;
      
      const channelName = currentChannel.name;
      toggleFavorite(channelName);
      
      const isFavorite = favorites[channelName] || false;
      ytFavoriteBtn.innerHTML = `
        <i class="fa-${isFavorite ? 'solid' : 'regular'} fa-heart"></i>
        <span>${isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</span>
      `;
      ytFavoriteBtn.classList.toggle('active', isFavorite);
    });

    // Search functionality
    searchBar.addEventListener('input', (e) => renderChannelList(e.target.value));
    searchBarMobile.addEventListener('input', (e) => renderChannelList(e.target.value));

    // Function to fetch and display the channel list
    async function loadChannels() {
      console.log("Starting to load channels...");
      loadingChannels.style.display = 'flex';
      
      try {
        const currentJsonUrl = localStorage.getItem('customJsonUrl') || DEFAULT_JSON_URL;
        console.log(`Loading channels from: ${currentJsonUrl}`);
        
        let m3uContent;
        
        if (currentJsonUrl.startsWith('http://') || currentJsonUrl.startsWith('https://')) {
          const response = await fetch(currentJsonUrl);
          if (!response.ok) {
            throw new Error('Failed to fetch channels');
          }
          m3uContent = await response.text();
        } else {
          // Use ipcRenderer to read local files instead of direct Node.js fs module
          m3uContent = await new Promise((resolve, reject) => {
            ipcRenderer.once('local-file-content', (event, { content, error }) => {
              if (error) {
                reject(new Error(error));
              } else {
                resolve(content);
              }
            });
            
            ipcRenderer.send('read-local-file', { filePath: currentJsonUrl });
          });
        }
        
        channels = parseM3U(m3uContent);
        filteredChannels = channels;
        
        createCategoryTabs();
        renderChannelList();
        loadingChannels.style.display = 'none';
        loadFavoritesCarousel();
      } catch (error) {
        console.error('Error loading channels:', error);
        loadingChannels.style.display = 'none';
        
        channelList.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-exclamation-triangle empty-icon"></i>
            <h3 class="empty-title">Failed to load channels</h3>
            <p class="empty-subtitle">${error.message}</p>
          </div>
        `;
        
        showNotification('Failed to load channels. Check the console for details.');
      }
    }

    // Function to parse M3U playlist format - simplified
    function parseM3U(content) {
      const lines = content.split('\n').filter(line => line.trim() !== '');
      
      // Check if valid M3U
      let startIndex = 0;
      let isValid = false;
      
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i];
        if (line.startsWith('#EXTM3U')) {
          isValid = true;
          startIndex = i;
          break;
        } else if (line.startsWith('#EXTINF:')) {
          isValid = true;
          break;
        }
      }
      
      if (!isValid) {
        throw new Error('Invalid M3U playlist format - not a valid M3U file');
      }
      
      const channels = [];
      let currentChannel = {};
      let expectingUrl = false;
      
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('//') || line === '') {
          continue;
        }
        
        if (line.startsWith('#EXTINF:')) {
          currentChannel = {};
          expectingUrl = true;
          
          const groupMatch = line.match(/group-title="([^"]*)"/i);
          const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
          
          const lastCommaIndex = line.lastIndexOf(',');
          if (lastCommaIndex !== -1) {
            currentChannel.name = line.substring(lastCommaIndex + 1).trim();
          } else {
            currentChannel.name = `Channel ${channels.length + 1}`;
          }
          
          currentChannel.category = groupMatch ? groupMatch[1] : null;
          currentChannel.logo = logoMatch ? logoMatch[1] : 'icon.png';
          
        } else if (line.startsWith('#EXTVLCOPT:')) {
          if (line.includes('http-user-agent=')) {
            const uaStartIndex = line.indexOf('=') + 1;
            currentChannel.userAgent = line.substring(uaStartIndex).trim();
          }
          
        } else if (line.startsWith('#EXTHTTP:')) {
          try {
            const jsonStartIndex = line.indexOf('{');
            if (jsonStartIndex !== -1) {
              const jsonStr = line.substring(jsonStartIndex);
              const httpData = JSON.parse(jsonStr);
              currentChannel.cookie = httpData.cookie || '';
            }
          } catch (e) {
            currentChannel.cookie = '';
          }
          
        } else if (!line.startsWith('#') && expectingUrl) {
          currentChannel.link = line;
          expectingUrl = false;
          
          if (currentChannel.name && currentChannel.link) {
            channels.push({...currentChannel});
          }
        }
      }
      
      return channels;
    }

    // Handle Escape key to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (settingsModal.style.display === 'flex') {
          closeSettingsBtn.click();
        }
        if (searchModal.classList.contains('show')) {
          closeSearchModal.click();
        }
        if (channelListColumn.classList.contains('show')) {
          channelListColumn.classList.remove('show');
          overlay.classList.remove('show');
        }
      }
    });

    // Close modals when clicking outside
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        closeSettingsBtn.click();
      }
    });

    // Responsive adjustments
    function handleResponsiveLayout() {
      toggleChannelList.style.display = window.innerWidth <= 900 ? 'flex' : 'none';
      if (window.innerWidth > 900) {
        channelListColumn.classList.remove('show');
        overlay.classList.remove('show');
      }
      
      searchButtonMobile.style.display = window.innerWidth <= 640 ? 'flex' : 'none';
      if (window.innerWidth > 640) {
        searchModal.classList.remove('show');
      }
    }

    window.addEventListener('resize', handleResponsiveLayout);
    handleResponsiveLayout();

    // Initialize the app
    loadChannels();
});