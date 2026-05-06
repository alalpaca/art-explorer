# Technical Design Document (TECHDESIGN)

> ## Project Name: Art Collection Explorer with Favorites

# 1. System Overview

Art Collection Explorer with Favorites is a full-stack web application that allows users to search artworks across multiple museum sources, explore detailed artwork information in a tabbed interface, and save favorite artworks for later access.
The application uses a Node.js/Express backend as a secure API proxy and orchestration layer, and an HTML/CSS/JavaScript frontend enhanced with Bootstrap 5 and Leaflet.js.
The backend integrates data from Met Museum, Harvard Art Museums, and Wikipedia, while keeping the Harvard API key server-side only.
The project is containerized with Docker and deployed to Google Cloud Run.

------------------------------------------------------------------------

# 2. Technology Stack

## 2.1 Frontend

HTML/CSS/JavaScript served by Express from the `public/` directory.

- HTML5 -- Page structure and semantic layout
- CSS3 -- Custom styling layered on Bootstrap
- JavaScript (ES6+) -- View orchestration, state, and events
- Bootstrap 5 (CDN) -- Responsive grid, components, and tabs
- Leaflet.js (CDN) -- Interactive museum location map
- Fetch API -- Communication with Express backend
- localStorage -- Persistent favorites

Restrictions:
- No frontend frameworks (React, Vue, Angular, etc.)
- Bootstrap 5 must be used via CDN
- Leaflet.js must be used via CDN
- Must work in the latest version of Google Chrome

## 2.2 Backend

- Node.js 18+
- Express
- node-fetch (or built-in fetch for supported Node versions)
- Environment variables for secrets and runtime configuration

Responsibilities:
- Serve static frontend files
- Proxy and orchestrate external API requests
- Normalize Met and Harvard artwork data into a unified schema
- Provide paginated search response to frontend
- Protect Harvard API key from client-side exposure

## 2.3 External APIs

Important Notes: use the following API and links below in the codes, I will manually substitute `YOUR_KEY` later.

### Met Museum API (No key required)

Used for searching objects and retrieving object details.

Main endpoints:
- Search object IDs
  - `https://collectionapi.metmuseum.org/public/collection/v1/search?q={query}&hasImages={true|false}`
- Object details
  - `https://collectionapi.metmuseum.org/public/collection/v1/objects/{objectID}`

### Harvard Art Museums API (API key required)

Used for keyword search with server-side pagination and object details.

Main endpoints:
- Search objects
  - `https://api.harvardartmuseums.org/object?keyword={query}&apikey={YOUR_KEY}&size=20&page={page}`
- Object details
  - `https://api.harvardartmuseums.org/object/{id}?apikey={YOUR_KEY}`

### Wikipedia REST API (No key required)

Used for artist biography tab content.

Main endpoint:
- Artist summary
  - `https://en.wikipedia.org/api/rest_v1/page/summary/{artist_name}`

------------------------------------------------------------------------

# 3. System Architecture

Browser (Client)
→ fetch()
→ Express Backend
→ Met / Harvard / Wikipedia APIs
→ Normalized JSON Response
→ Rendered UI

Deployment Layer:
Docker Container → Google Cloud Run

The frontend only communicates with the Express backend.
The backend handles all external API requests and secrets.
No API key is exposed to the browser.

------------------------------------------------------------------------

# 4. Application Architecture

## 4.1 Main Views

### Search View
Displays:
- search input and search button
- source dropdown (`met`, `harvard`, `both`)
- image-only checkbox
- loading skeleton placeholders
- responsive result card grid
- pagination controls

### Detail View (Tabbed)
Displays Bootstrap tabs:
- Overview
- Biography
- Related Works
- Museum Location

### Favorites View
Displays:
- cards loaded from localStorage
- remove favorite actions
- empty-state when no saved items exist

## 4.2 Core Frontend Modules

### 1. Search Controller (`app.js`)
Responsibilities:
- validate query input
- handle button-based and debounced (300ms) search
- track active query/filter/page state
- trigger result fetch and UI loading state

### 2. API Client (`api.js`)
Responsibilities:
- build query URLs for backend endpoints
- centralize fetch requests and response parsing
- standardize error handling for API failures

### 3. Results Renderer (`app.js`)
Responsibilities:
- render normalized cards in Bootstrap grid
- render source badges and metadata fields
- bind card click events to load detail view
- render pagination and handle page navigation

### 4. Detail Tabs Renderer (`app.js`)
Responsibilities:
- render tab layout using Bootstrap tab component
- render Overview metadata and favorite button state
- fetch/render Biography and Related Works lazily or eagerly
- initialize map rendering when Museum Location tab is shown

### 5. Favorites Manager (`favorites.js`)
Responsibilities:
- CRUD operations for localStorage favorites
- keep favorite state synchronized across views
- render favorites grid and remove actions

### 6. Map Module (`map.js`)
Responsibilities:
- initialize Leaflet map container
- place marker by source museum coordinates
- avoid duplicate map initialization errors during tab switches

## 4.3 Frontend State Model

Suggested in-memory state shape:
- `query`: current search keyword
- `source`: `met` | `harvard` | `both`
- `hasImage`: boolean
- `page`: current page number
- `results`: current normalized result list
- `totalPages`: computed or backend-provided page count
- `selectedArtwork`: selected card summary/detail payload
- `activeView`: `search` | `detail` | `favorites`

Persistent state:
- `favorites`: stored in localStorage under a stable key (example: `ae_favorites_v1`)

------------------------------------------------------------------------

# 5. Backend Design

## 5.1 Express Routes

### `GET /`
Serves `public/index.html`.

### `GET /api/search`
Query parameters:
- `q` (required): artwork keyword
- `page` (optional, default `1`): result page
- `source` (optional, default `both`): `met` | `harvard` | `both`
- `hasImage` (optional): `true` to only return artworks with images

Returns:
- normalized artwork list for requested page
- pagination metadata (at minimum current page)

### `GET /api/artwork/:source/:id`
Returns:
- normalized artwork detail payload for a single record
- includes fields needed by Overview and Museum Location tabs

### `GET /api/artist/:name`
Returns:
- Wikipedia summary payload for artist biography tab

### `GET /api/artist/:name/works`
Returns:
- normalized related artworks list for the same artist

## 5.2 Service Layer Responsibilities

Suggested backend layering in `server.js` (or helper modules):
- request validation helpers
- API client helpers (Met/Harvard/Wikipedia)
- normalization helpers
- pagination helpers
- route handlers

Benefits:
- smaller handlers
- easier testability
- consistent response contracts

## 5.3 Environment Variables

Backend secrets/config:
- `HARVARD_API_KEY`
- `PORT` (Cloud Run default is `8080`)

Security requirements:
- never hardcode keys
- never return keys in any API response
- never include keys in frontend files or commits

## 5.4 Error Handling

Backend should handle:
- missing required query (`q`)
- invalid `source` or `page` values
- upstream API failure/timeouts
- upstream data missing critical fields
- Wikipedia missing/ambiguous pages

Recommended response pattern:
- use consistent JSON with `error` and optional `details`
- map validation issues to `400`
- map upstream failures to `502`/`500`

------------------------------------------------------------------------

# 6. Data Contract & Normalization

## 6.1 Unified Artwork Summary (Search Card)

Normalized fields (example):
- `id` (string/number)
- `source` (`met` | `harvard`)
- `title`
- `artist`
- `date`
- `imageUrl`
- `hasImage` (boolean)
- `museumName`

## 6.2 Unified Artwork Detail (Overview Tab)

Normalized fields (example):
- `id`, `source`, `title`, `artist`, `date`
- `medium`
- `dimensions`
- `imageUrl` (large)
- `museumName`
- `museumLocation` (`lat`, `lng`, display name)
- `artistNameForWiki`

## 6.3 Mapping Notes by Source

### Met Museum
- Search endpoint returns object IDs only; details require per-ID requests.
- Some records have missing `primaryImageSmall` and/or artist/date fields.
- `repository` can be used as museum label when available.

### Harvard Art Museums
- Search endpoint already supports page and size.
- Common image field candidates may vary; mapping should use best available image URL.
- Artist name may come from people arrays and may be absent.

Normalization rule:
- always return stable keys to frontend
- fill missing values with empty string or `null` consistently

------------------------------------------------------------------------

# 7. Pagination & Search Strategy

## 7.1 API-Level Strategy

- Harvard:
  - Use native `page` + `size` query options directly.
- Met:
  - Search returns many IDs; backend slices IDs per requested page, then fetches object details for that slice.

## 7.2 Combined Source Strategy (`source=both`)

Recommended strategy for predictability:
- Fetch one page from Harvard and one page-worth slice from Met
- Normalize and merge results
- Optionally interleave by source for balanced display

Alternative strategy:
- fetch from both, concatenate, then apply deterministic sort

Chosen behavior must remain stable between page navigations.

## 7.3 Debounced Search

- Frontend delay: 300ms after typing stops
- New keystrokes cancel pending request trigger
- Prevent stale responses from overwriting latest result state

------------------------------------------------------------------------

# 8. Favorites Design

## 8.1 Storage Model

Use localStorage with one key, for example:
- `ae_favorites_v1`

Data format:
- array of normalized summary objects
- each item uniquely identified by composite key: `{source}:{id}`

## 8.2 Operations

- `addFavorite(item)`:
  - insert if not already present
- `removeFavorite(source, id)`:
  - remove by composite key
- `isFavorite(source, id)`:
  - boolean check for UI state
- `getFavorites()`:
  - return ordered list (e.g., newest first)

## 8.3 Consistency Rules

- Any add/remove in detail view updates card state immediately
- Search/favorites views re-render based on latest storage snapshot
- Handle localStorage read/write exceptions gracefully

------------------------------------------------------------------------

# 9. UI Component Design

## 9.1 Bootstrap 5 Requirements

- Use Bootstrap grid and cards for responsive results/favorites layout
- Use Bootstrap nav-tabs/tab-content for detail tabs
- Use Bootstrap utility classes for spacing and typography

## 9.2 Loading and Empty States

- Search loading: skeleton placeholders
- Search empty: no results message
- Favorites empty: no favorites saved message
- Tab-level fallback text for missing biography/related works/map data

## 9.3 Leaflet Map Integration

Required CDN includes:
- `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css`
- `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`

Museum coordinates:
- The Metropolitan Museum of Art: `40.7794, -73.9632`
- Harvard Art Museums: `42.3744, -71.1143`

Implementation notes:
- initialize map only when map tab is visible
- invalidate size after tab activation if needed
- cleanly reuse/destroy map instance between detail records

------------------------------------------------------------------------

# 10. Project Structure

```text
art-explorer/
├── server.js
├── package.json
├── package-lock.json
├── Dockerfile
├── .gitignore
└── public/
    ├── index.html
    ├── css/
    │   └── styles.css
    └── js/
        ├── app.js
        ├── api.js
        ├── favorites.js
        └── map.js
```

**File Responsibilities:**
- `server.js`
  - Express app bootstrap
  - route handlers
  - external API orchestration
  - normalization and error handling
- `package.json`
  - dependencies, scripts, and runtime metadata
- `Dockerfile`
  - production image build and startup
- `public/index.html`
  - page layout, Bootstrap/Leaflet CDN includes, view containers
- `public/css/styles.css`
  - custom styles for cards, tabs, states, and responsiveness
- `public/js/api.js`
  - backend endpoint wrappers
- `public/js/favorites.js`
  - localStorage favorite operations
- `public/js/map.js`
  - Leaflet map init/update utilities
- `public/js/app.js`
  - app initialization, event wiring, rendering and state flow

------------------------------------------------------------------------

# 11. Data Flow

Search flow:
- user enters query/filter
- frontend validates input
- frontend calls `/api/search`
- backend requests Met/Harvard APIs based on source
- backend normalizes and returns paginated list
- frontend renders cards + pagination

Detail flow:
- user clicks card
- frontend calls `/api/artwork/:source/:id`
- frontend calls `/api/artist/:name` and `/api/artist/:name/works` as needed
- backend fetches and normalizes data
- frontend renders Bootstrap tabs and initializes Leaflet map tab

Favorites flow:
- user clicks add/remove favorite
- frontend updates localStorage via `favorites.js`
- active view re-renders to reflect latest favorite state

------------------------------------------------------------------------

# 12. Error Handling Strategy

| Scenario | Handling |
| --- | --- |
| Empty search input | show validation and skip API call |
| Invalid query params (`page`, `source`) | return `400` with clear message |
| Met or Harvard API failure | return controlled error; show user-friendly UI alert |
| Wikipedia summary not found | show fallback biography message |
| Missing image fields | render placeholder image/card style |
| Missing artist/date/medium/dimensions | render available fields only |
| localStorage unavailable | disable favorite mutation with non-blocking feedback |
| stale async response race | ignore responses that do not match latest request token |

------------------------------------------------------------------------

# 13. Deployment Workflow

1. Initialize project and install dependencies:
   - `npm init -y`
   - `npm install express node-fetch`
2. Build and verify Docker image locally.
3. Set Google Cloud project and enable required services.
4. Build container via Cloud Build.
5. Deploy to Cloud Run with `HARVARD_API_KEY` environment variable.
6. Verify deployed app behavior in latest Chrome.
7. Redeploy with source/image updates as needed.

Reference Dockerfile:

```dockerfile
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 8080
CMD ["node", "server.js"]
```

------------------------------------------------------------------------

# 14. Security Considerations

- Keep `HARVARD_API_KEY` only in environment variables.
- Never place secrets in frontend JavaScript or HTML.
- Never commit API keys to version control.
- Validate and sanitize user inputs before proxying requests.
- Limit backend response payload to required fields only.

------------------------------------------------------------------------

# 15. Quality and Grading Alignment

This technical design aligns with assignment requirements:
- Node.js/Express backend proxy
- multi-API orchestration and normalization
- server-side pagination
- Bootstrap 5 responsive cards and tabs
- Leaflet map integration
- localStorage favorites persistence
- Cloud Run deployment with env var key management

Implementation should avoid common grading penalties:
- missing Bootstrap tabs
- missing Leaflet integration
- exposed API keys
- missing pagination behavior
- missing favorites persistence
- missing deployment artifacts (`Dockerfile`, `package-lock.json`)

