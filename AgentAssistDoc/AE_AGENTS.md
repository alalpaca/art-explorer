# Art Explorer Development Guide

## Project Overview

Full-stack web application for searching artworks, viewing artwork details in tabs, and managing favorites.
Built with vanilla HTML, CSS, JavaScript, Node.js/Express, Bootstrap 5, and Leaflet.js.
Backend acts as a proxy/orchestrator for Met Museum, Harvard Art Museums, and Wikipedia APIs to protect secrets.
Deployed using Docker to Google Cloud Run.

------------------------------------------------------------------------

## Tech Stack

- HTML5
- CSS3 (custom styles + Bootstrap 5 utilities/components)
- JavaScript (ES6+)
- Node.js / Express
- Fetch API with async/await
- Bootstrap 5 (via CDN)
- Leaflet.js (via CDN)
- Browser localStorage (favorites persistence)
- Docker
- Google Cloud Run

------------------------------------------------------------------------

## Development Rules

- Use Node.js + Express for all backend functionality.
- Keep Harvard API key on server side only.
- Read Harvard API key from environment variables.
- Use fetch() for all frontend API calls to backend routes.
- Use async/await for asynchronous logic.
- Use DOM manipulation for dynamic rendering.
- Use Bootstrap 5 tabs for the detail view tabbed interface.
- Use Leaflet.js for museum location map rendering.
- Keep code modular, readable, and well-commented.
- Make sure the app works in the latest version of Google Chrome.

------------------------------------------------------------------------

## Application Structure

- `public/index.html` for the main page
- `public/css/styles.css` for styling
- `public/js/app.js` for app orchestration and rendering
- `public/js/api.js` for backend API wrappers
- `public/js/favorites.js` for localStorage favorites logic
- `public/js/map.js` for Leaflet map logic
- `server.js` for Express routes and API orchestration
- `package.json` and `package-lock.json` for Node dependencies
- `Dockerfile` for containerization

------------------------------------------------------------------------

## UI & UX Requirements

- Search input + Search button
- Source dropdown: `met` / `harvard` / `both`
- Checkbox: only show artworks with images
- Debounced search-as-you-type (300ms)
- Bootstrap card grid for search results
- Pagination controls (Previous / Next / page indicator)
- Loading skeleton placeholders during fetch
- Detail view using Bootstrap tabs:
  - Overview
  - Biography
  - Related Works
  - Museum Location
- Favorites view with remove action and empty state

------------------------------------------------------------------------

## Backend Requirements

- `GET /` serves `index.html`.
- `GET /api/search` searches Met and/or Harvard with query params:
  - `q` (required)
  - `page` (default `1`)
  - `source` (`met`, `harvard`, `both`; default `both`)
  - `hasImage` (`true` for image-only results)
- `GET /api/artwork/:source/:id` returns normalized artwork detail data.
- `GET /api/artist/:name` returns artist biography from Wikipedia.
- `GET /api/artist/:name/works` returns related artworks by artist.
- Backend responses should be JSON.
- Normalize cross-source data into consistent frontend fields.
- Handle missing data and API failures gracefully.
- Do not expose API keys in client-side code.

------------------------------------------------------------------------

## Deployment Requirements

- Use Docker for deployment.
- Container must listen on port 8080.
- Deploy to Google Cloud Run.
- Enable unauthenticated access for deployed service.
- Configure `HARVARD_API_KEY` via Cloud Run environment variables.

------------------------------------------------------------------------

## Code Quality Guidelines

- Keep Express routes concise and organized.
- Separate HTML, CSS, and JavaScript cleanly.
- Avoid duplicated logic across frontend/backend.
- Keep data mapping/normalization centralized in backend helpers.
- Ensure favorites state stays consistent across Search, Detail, and Favorites views.
- Handle edge cases such as:
  - empty or whitespace-only search terms
  - invalid page/source query parameters
  - empty API responses
  - missing artwork images
  - missing artist biography
  - missing related works
  - map rendering when location data is unavailable
  - localStorage unavailable/quota errors
  - network or server errors
- Write code that is easy to explain and maintain.

------------------------------------------------------------------------

## Important Notes

- Must use Node.js/Express backend.
- Must use Bootstrap 5 via CDN.
- Must use Leaflet.js via CDN.
- Do not use React, Vue, Angular, or other frontend frameworks.
- Do not hardcode API keys in any source file.
- Do not commit secrets to version control.
- Do not generate code or features beyond assignment requirements.

