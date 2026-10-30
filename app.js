let player;
let playerReady = false;

let songs = [];
let currentIndex = -1;
let likedSongs = JSON.parse(
    localStorage.getItem("gsLikedSongs") || "[]"
);

let playlistId = "";
let playlistNextToken = null;

function onYouTubeIframeAPIReady() {
    player = new YT.Player("youtubePlayer", {
        height: "1",
        width: "1",
        videoId: "",
        playerVars: {
            playsinline: 1
        },
        events: {
            onReady: () => {
                playerReady = true;
            },
            onStateChange: onPlayerStateChange
        }
    });
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        document.getElementById("playButton").textContent = "Ⅱ";
    }

    if (event.data === YT.PlayerState.PAUSED ||
        event.data === YT.PlayerState.ENDED) {
        document.getElementById("playButton").textContent = "▶";
    }

    if (event.data === YT.PlayerState.ENDED) {
        nextSong();
    }
}

async function api(url) {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Request failed");
    }

    return data;
}

function showSection(section) {
    const sections = {
        home: "homeSection",
        search: "searchSection",
        library: "librarySection",
        liked: "likedSection"
    };

    Object.values(sections).forEach(id => {
        document.getElementById(id).hidden = true;
    });

    document.getElementById(sections[section]).hidden = false;

    document.querySelectorAll(".nav").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.section === section
        );
    });

    if (section === "liked") {
        renderSongs(likedSongs, "likedResults");
    }
}

document.querySelectorAll(".nav").forEach(button => {
    button.addEventListener("click", () => {
        showSection(button.dataset.section);
    });
});

function showSearch() {
    showSection("search");
    document.getElementById("searchInput").focus();
}

function getVideoId(item) {
    return item.id?.videoId ||
        item.contentDetails?.videoId;
}

function normalizeSong(item) {
    return {
        id: getVideoId(item),
        title: item.snippet?.title || "Unknown Song",
        artist: item.snippet?.channelTitle || "Unknown Artist",
        image:
            item.snippet?.thumbnails?.medium?.url ||
            item.snippet?.thumbnails?.default?.url
    };
}

async function searchMusic() {
    const query = document
        .getElementById("searchInput")
        .value.trim();

    if (!query) return;

    const container = document.getElementById("searchResults");
    container.innerHTML = "<p>Searching music...</p>";

    try {
        const data = await api(
            "/api/search?q=" + encodeURIComponent(query)
        );

        songs = (data.items || [])
            .map(normalizeSong)
            .filter(song => song.id);

        renderSongs(songs, "searchResults");
    } catch (error) {
        container.innerHTML = `<p>${escapeHTML(error.message)}</p>`;
    }
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function renderSongs(list, containerId) {
    const container = document.getElementById(containerId);

    if (!list.length) {
        container.innerHTML = "<p>No songs found.</p>";
        return;
    }

    container.innerHTML = list.map((song, index) => {
        const liked = likedSongs.some(item => item.id === song.id);

        return `
        <div class="song-card">
            <img src="${escapeHTML(song.image || "")}" alt="">
            <h3>${escapeHTML(song.title)}</h3>
            <p>${escapeHTML(song.artist)}</p>

            <div class="song-actions">
                <button class="play-btn"
                    onclick="playSong('${escapeHTML(song.id)}')">
                    ▶
                </button>

                <button class="like-btn"
                    onclick="toggleLike('${escapeHTML(song.id)}')">
                    ${liked ? "♥" : "♡"}
                </button>
            </div>
        </div>`;
    }).join("");
}

function playSong(videoId) {
    if (!playerReady) {
        alert("Player is loading. Please try again.");
        return;
    }

    const index = songs.findIndex(song => song.id === videoId);

    if (index >= 0) {
        currentIndex = index;
    }

    const song = songs.find(item => item.id === videoId);

    if (song) {
        document.getElementById("currentTitle").textContent = song.title;
        document.getElementById("currentArtist").textContent = song.artist;

        document.getElementById("playerCover").innerHTML =
            `<img src="${escapeHTML(song.image || "")}"
             style="width:100%;height:100%;object-fit:cover;border-radius:9px">`;
    }

    player.loadVideoById(videoId);
}

function togglePlay() {
    if (!playerReady) return;

    if (player.getPlayerState() === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

function nextSong() {
    if (!songs.length) return;

    currentIndex = (currentIndex + 1) % songs.length;
    playSong(songs[currentIndex].id);
}

function previousSong() {
    if (!songs.length) return;

    currentIndex =
        (currentIndex - 1 + songs.length) % songs.length;

    playSong(songs[currentIndex].id);
}

function toggleLike(videoId) {
    const song = songs.find(item => item.id === videoId);

    if (!song) return;

    const exists = likedSongs.some(item => item.id === videoId);

    if (exists) {
        likedSongs = likedSongs.filter(item => item.id !== videoId);
    } else {
        likedSongs.push(song);
    }

    localStorage.setItem(
        "gsLikedSongs",
        JSON.stringify(likedSongs)
    );

    renderSongs(songs, "searchResults");
    renderSongs(likedSongs, "likedResults");
}

async function loadPlaylist() {
    const input = document
        .getElementById("playlistInput")
        .value.trim();

    const match = input.match(/[?&]list=([^&]+)/);
    playlistId = match ? match[1] : input;

    if (!playlistId) {
        alert("Enter a YouTube playlist URL or ID.");
        return;
    }

    playlistNextToken = null;
    document.getElementById("playlistResults").innerHTML =
        "<p>Loading playlist...</p>";

    try {
        const info = await api(
            "/api/playlist/" + encodeURIComponent(playlistId)
        );

        const title = info.items?.[0]?.snippet?.title || "Playlist";

        document.getElementById("playlistTitle").textContent = title;

        const data = await api(
            "/api/playlist/" +
            encodeURIComponent(playlistId) +
            "/items"
        );

        songs = (data.items || [])
            .map(normalizeSong)
            .filter(song => song.id);

        playlistNextToken = data.nextPageToken || null;

        renderSongs(songs, "playlistResults");

        document.getElementById("morePlaylist").hidden =
            !playlistNextToken;

    } catch (error) {
        document.getElementById("playlistResults").textContent =
            error.message;
    }
}

async function loadMorePlaylist() {
    if (!playlistNextToken) return;

    try {
        const data = await api(
            "/api/playlist/" +
            encodeURIComponent(playlistId) +
            "/items?pageToken=" +
            encodeURIComponent(playlistNextToken)
        );

        const newSongs = (data.items || [])
            .map(normalizeSong)
            .filter(song => song.id);

        songs = [...songs, ...newSongs];

        playlistNextToken = data.nextPageToken || null;

        renderSongs(songs, "playlistResults");

        document.getElementById("morePlaylist").hidden =
            !playlistNextToken;

    } catch (error) {
        alert(error.message);
    }
}

// Player progress
setInterval(() => {
    if (!playerReady ||
        player.getPlayerState() !== YT.PlayerState.PLAYING) {
        return;
    }

    const current = player.getCurrentTime();
    const duration = player.getDuration();

    const format = seconds => {
        const minutes = Math.floor(seconds / 60);
        const remaining = Math.floor(seconds % 60);

        return `${minutes}:${String(remaining).padStart(2, "0")}`;
    };

    document.getElementById("currentTime").textContent =
        format(current);

    document.getElementById("duration").textContent =
        format(duration);

    document.getElementById("progress").style.width =
        duration ? `${(current / duration) * 100}%` : "0%";

}, 1000);

// Initial screen
showSection("home");