# StreamX IPTV — Product Requirements

## Vision
A modern, Netflix-style IPTV streaming app that logs in with either Xtream Codes API credentials or an M3U playlist URL, and plays Live TV, Movies, and Series in HD/4K.

## Users
- IPTV subscribers using their provider's Xtream Codes credentials
- Users with a public/private M3U playlist URL

## Feature Set (MVP)
1. **Login** — Xtream Codes (Server URL + Username + Password, default tab) OR M3U URL (secondary tab), Remember Me (SecureStore)
2. **Home Dashboard** — hero, greeting from Xtream user_info, 5 shortcuts (Live TV / Movies / Series / Catch Up / Favorites), global search bar
3. **Live TV** — horizontal category chips, channel list with number + logo + name, tap to play
4. **Movies** — poster grid with sub-category filter (Xtream only)
5. **Series** — poster grid with sub-category filter + detail page with seasons/episodes (Xtream only)
6. **VOD Detail** — title, year, rating, genre, plot, play button for movies, seasons + episodes list for series
7. **Favorites** — any live/movie/series item can be hearted and appears on the home screen + /favorites
8. **Search** — global search across live/movies/series by name
9. **Settings** — account/subscription info (username, server, max connections, expiry date from Xtream), parental PIN (4–6 digits)
10. **Parental Control** — PIN stored in SecureStore, categories whose names match adult keywords (adult, xxx, 18+, porn, erotic, +18, sex) auto-lock; enter PIN once → unlock session for 10 min
11. **Built-in Player** — expo-video with HLS support (`.m3u8`), rotation unlock on open, back/favorite overlay chrome

## Tech
- **Backend**: FastAPI thin proxy — `/api/proxy/text` (M3U fetch, VLC UA) + `/api/proxy/xtream` (player_api.php passthrough), zero DB
- **Frontend**: Expo React Native + expo-router + expo-video + expo-secure-store + expo-image, Netflix-dark theme in `src/theme.ts` with purple (#7C3AED) + blue (#3B82F6) accents

## Out of scope (deferred)
- EPG grid, Catch Up / tv_archive playback
- Chromecast / AirPlay
- Subtitle/audio track picker UI (expo-video handles natively)
- Android TV D-pad focus polish
- Multi-profile accounts

## No seeded data
Session is bootstrapped from user's Xtream creds or M3U URL. No test credentials in the repo.
