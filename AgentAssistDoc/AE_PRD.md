# PRD of Art Collection Explorer with Favorites

## Project Name

**Art Collection Explorer with Favorites**

------------------------------------------------------------------------

## 1. Background & Objective

### 1.1 Project Background

The goal of this project is to build a full-stack Art Collection Explorer web application that searches across multiple museum sources, presents normalized and paginated artwork results, and allows users to save favorites for later access.
The backend is built with Node.js and Express as a secure API proxy and orchestrator for Met Museum, Harvard Art Museums, and Wikipedia APIs, while the frontend is built with HTML, CSS, and JavaScript using Bootstrap 5 and Leaflet.js (via CDN).
The Harvard API key must be stored on the server side through environment variables and must never be exposed in client-side code.

### 1.2 Objectives

- Build a server-side API proxy and aggregation layer using Node.js and Express
- Orchestrate Met Museum, Harvard Art Museums, and Wikipedia APIs and normalize response data
- Implement server-side pagination for large result sets
- Build a responsive frontend using Bootstrap 5 components and layout
- Implement a tabbed artwork detail view using Bootstrap 5 tabs
- Integrate museum location maps using Leaflet.js
- Persist user favorites in browser localStorage across sessions
- Deploy the application to Google Cloud Run using Docker

------------------------------------------------------------------------

## 2. Scope

### 2.1 In Scope

- Search artworks by keyword
- Source filter: Met only, Harvard only, or both
- Optional filter: only artworks with images
- Debounced search-as-you-type (300ms)
- Server-side paginated results
- Responsive Bootstrap card grid for search results
- Artwork detail view with Bootstrap tabbed interface
- Artist biography from Wikipedia
- Related works by the same artist
- Museum location map with Leaflet.js
- Favorites view backed by localStorage
- Docker containerization
- Deployment to Google Cloud Run
- Environment-based Harvard API key management

### 2.2 Out of Scope

- Frontend frameworks (React, Vue, Angular, etc.)
- Alternative CSS frameworks beyond required Bootstrap 5
- User authentication system
- Database persistence for favorites (localStorage only)
- Mobile app development
- Backend frameworks other than Express

------------------------------------------------------------------------

## 3. Target Users

- General users interested in browsing and saving artworks
- Course instructor and TAs for grading
- Developers reviewing API orchestration, frontend behavior, and deployment

------------------------------------------------------------------------

## 4. Functional Requirements

### 4.1 Search View

#### UI Components

- Text Input: Users enter artwork keyword(s)
- Search Button: Triggers explicit search request
- Source Dropdown: `met`, `harvard`, or `both`
- Checkbox: `Only show artworks with images`
- Pagination Controls: Previous, Next, and page indicator

#### Functional Behavior

1. User enters a keyword and can search via:
   - Clicking Search button, or
   - Debounced typing (300ms delay)
2. If input is empty:
   - Display a validation message and do not call backend
3. Call backend endpoint:
   - `/api/search?q={query}&page={page}&source={source}&hasImage={true|false}`
4. Show loading skeleton placeholders while data is being fetched
5. Render normalized search results as responsive Bootstrap cards
6. Support pagination through Previous/Next controls and current page indicator

------------------------------------------------------------------------

### 4.2 Search Results View

#### Display Format

Results must be shown as Bootstrap cards in a responsive grid.

#### Each Card Must Include

- Artwork image thumbnail (if available)
- Artwork title
- Artist name (if available)
- Date/period (if available)
- Source badge (Met or Harvard)

#### States

- If no results are found: Display a friendly empty-state message
- Show skeleton loading placeholders during API requests
- Handle missing images gracefully (fallback placeholder or image-free card style)

------------------------------------------------------------------------

### 4.3 Artwork Detail View (Bootstrap Tabs)

When the user clicks an artwork card, display a detail view using Bootstrap tabs.

#### Required Tabs

- **Overview Tab**
  - Large image
  - Title, artist, date, medium, dimensions
  - Add to Favorites / Remove from Favorites button
- **Biography Tab**
  - Artist summary from Wikipedia
  - Link to full Wikipedia article
- **Related Works Tab**
  - Other artworks by the same artist
- **Museum Location Tab**
  - Interactive Leaflet.js map showing museum location

#### Functional Behavior

- Clicking a card opens the detail view
- Tab switching must use Bootstrap 5 tabs component
- Favorites toggle updates localStorage and UI state immediately
- Missing biography, related works, or map data must be handled gracefully

------------------------------------------------------------------------

### 4.4 Favorites View

#### UI Requirements

- Display all saved artworks from localStorage in a grid
- Each card includes a Remove from Favorites action
- Show a clear empty-state message when no favorites exist

#### Functional Behavior

- Favorites persist across browser sessions
- Removing an item updates localStorage and re-renders list immediately
- Favorite state remains consistent between Search, Detail, and Favorites views

------------------------------------------------------------------------

### 4.5 Backend API Endpoints

Implement the following Express routes:

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Serve the main `index.html` page |
| `/api/search` | GET | Search Met and/or Harvard APIs with pagination and filters |
| `/api/artwork/:source/:id` | GET | Get detailed artwork data from Met or Harvard |
| `/api/artist/:name` | GET | Get artist biography from Wikipedia |
| `/api/artist/:name/works` | GET | Get other works by the same artist |

#### `/api/search` Query Parameters

- `q`: search query (required)
- `page`: page number (default `1`)
- `source`: `met`, `harvard`, or `both` (default `both`)
- `hasImage`: `true` to filter artworks with images only

------------------------------------------------------------------------

### 4.6 External API Behavior

#### Met Museum API

The backend should:
- Search object IDs by keyword (and optional hasImages mode)
- Retrieve object details for result cards/detail view
- Normalize fields to a unified artwork schema

#### Harvard Art Museums API

The backend should:
- Search artworks by keyword with page and size controls
- Retrieve object details by Harvard object ID
- Use `HARVARD_API_KEY` from environment variables only
- Normalize fields to the same unified artwork schema used for Met results

#### Wikipedia API

The backend should:
- Fetch artist summaries for Biography tab
- Return description/extract and canonical article URL
- Handle missing pages or ambiguous names gracefully

------------------------------------------------------------------------

## 5. Non-Functional Requirements

### Technical Constraints

- Must use Node.js and Express for backend
- Must use Bootstrap 5 via CDN for responsive UI and tabs
- Must use Leaflet.js via CDN for map rendering
- Must work in the latest version of Google Chrome
- Harvard API key must be read from environment variables
- API keys must never appear in client-side code
- Frontend frameworks are not allowed

### Performance and UX

- Debounced search delay should be 300ms
- Loading skeletons should appear during data fetches
- Pagination interactions should feel responsive and predictable

### Deployment Requirements

- Must use Docker
- Container must listen on port 8080
- Must deploy to Google Cloud Run
- Must allow unauthenticated access

------------------------------------------------------------------------

## 6. Required Project Structure

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

------------------------------------------------------------------------

## 7. User Flow

1. User opens the homepage
2. User enters a search keyword
3. User selects source filter and optional image-only filter
4. User triggers search (button click or debounced typing)
5. Loading skeletons appear
6. Paginated artwork results render as responsive cards
7. User changes pages via pagination controls if needed
8. User clicks an artwork card to open detail view
9. User navigates Overview/Biography/Related Works/Museum Location tabs
10. User adds or removes the artwork from favorites
11. User opens Favorites view to browse saved artworks
12. Favorites persist after browser refresh or restart

------------------------------------------------------------------------

## 8. Acceptance Criteria

- Empty query shows validation and does not call search API
- Search calls `/api/search` with proper query parameters
- Debounced search executes with ~300ms delay
- Results display as Bootstrap cards in a responsive grid
- Pagination (Previous/Next/page indicator) works correctly
- Source filter (`met`, `harvard`, `both`) affects result set correctly
- `hasImage=true` filter limits results to artworks with images
- Clicking an artwork opens tabbed detail view using Bootstrap tabs
- Overview tab shows image and key artwork metadata
- Biography tab shows Wikipedia summary or graceful fallback
- Related Works tab loads same-artist artworks or fallback state
- Museum Location tab renders Leaflet map for museum coordinates
- Favorites can be added/removed and persist via localStorage
- Favorites view supports remove action and empty-state message
- Harvard API key is not exposed in frontend code
- App is deployable and accessible on Google Cloud Run

------------------------------------------------------------------------

## 9. Risks & Edge Cases

| Risk | Mitigation |
| --- | --- |
| Empty or whitespace-only search input | Block request and show validation message |
| External API timeout/failure | Return controlled error response and show user-friendly message |
| Inconsistent fields across APIs | Normalize with fallback defaults in backend |
| Missing artwork image | Render placeholder image or image-free card style |
| Missing artist biography on Wikipedia | Show graceful "Biography not available" message |
| No related works found | Show empty-state within Related Works tab |
| Missing/invalid museum coordinates | Show map fallback text instead of broken map |
| localStorage unavailable/quota exceeded | Catch errors and show non-blocking feedback |
| Rapid user interactions during loading | Prevent duplicate requests and stale render races |

------------------------------------------------------------------------

## 10. Notes

- Backend must be Node.js + Express
- Bootstrap 5 and Leaflet.js must be loaded via CDN
- Detail view must use Bootstrap tabs component
- Do not expose API keys in frontend code or version control
- Favorites must persist across sessions using localStorage
- Deploy final application to Google Cloud Run and submit deployed URL

