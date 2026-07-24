# Deployment Guide — Rockford Historic Industrial Property Survey Map

This site is a static bundle (HTML/CSS/JS + GeoJSON data) — no server or build step required. It can be hosted anywhere that serves static files.

**Current plan:** publish on the Studio GWA GitHub org as a plain GitHub Pages site (`studiogwa.github.io/mpl-survey-map/`). The custom `studiogwa.com` domain is deferred for now — see "Later: custom domain" below for when you're ready.

## 1. Publish via the Studio GWA GitHub org

1. In the `studiogwa` (or whatever the org is actually named) GitHub organization, create a new repository — e.g. `mpl-survey-map`. Keep it public (GitHub Pages on a free plan requires a public repo unless the org has GitHub Enterprise). Leave "Initialize with a README" unchecked.
2. On the new repo's page, click **"uploading an existing file"** (the link in the quick-setup text, or Add file → Upload files from the repo's main page).
3. Open the `mpl-site` folder in Finder and drag these items into the browser upload area, all at once:
   - `index.html`
   - `style.css`
   - `config.js`
   - `app.js`
   - `DEPLOYMENT.md`
   - the `data` folder
   - the `assets` folder

   Do **not** upload the `_source` folder — that's just the raw pre-cleaned GIS export kept for reference, not part of the live site. Modern browsers preserve folder structure on drag-and-drop, so `data/` and `assets/` will land as real subfolders in the repo, not flattened.
4. Scroll down, add a commit message like "Initial site," and click **Commit changes**.
5. In the repo, go to **Settings → Pages**. Under "Build and deployment," set Source to "Deploy from a branch," branch `main`, folder `/ (root)`.
6. Save. GitHub will publish at `https://studiogwa.github.io/mpl-survey-map/` within a minute or two — that's the live URL to share for now.

**Updating the site later:** once it's live, any time you want to push a change, go back to the repo's file list, click into the file you edited (or use "Add file → Upload files" again to overwrite), and commit. No Terminal required at any point with this approach.

## Later: point a studiogwa.com URL at it

Whenever you're ready to move off the `github.io` URL, GitHub Pages only supports a custom domain at the root of a repo (e.g. `mpl.studiogwa.com`), not a path like `studiogwa.com/mpl`, unless `studiogwa.com` itself is the GitHub Pages site. Two realistic options at that point:

**Option A — subdomain (simplest):**
Use `mpl.studiogwa.com`.
1. In the repo's **Settings → Pages**, set the custom domain to `mpl.studiogwa.com` and enable "Enforce HTTPS."
2. This adds a `CNAME` file to the repo root automatically — verify it contains `mpl.studiogwa.com`.
3. In whatever DNS provider hosts studiogwa.com, add a CNAME record:
   `mpl` → `studiogwa.github.io`
4. DNS propagation is usually fast (minutes to a few hours).

**Option B — true path-based URL (studiogwa.com/mpl):**
Requires the main studiogwa.com site to reverse-proxy or redirect `/mpl` to the GitHub Pages URL, which depends on what platform studiogwa.com runs on (Squarespace, WordPress, custom server, etc.). Not possible on no-code platforms like Squarespace — the subdomain approach is the practical path there.

Let me know when you want to do this and which platform runs studiogwa.com, and I'll write the exact redirect/DNS config.

## 2. Google Analytics (GA4)

1. In Google Analytics, create a GA4 property for this site (or reuse an existing studiogwa.com property and add this as a new data stream — an app/web property with its own Measurement ID keeps the traffic distinguishable from the main site).
2. Copy the Measurement ID (format `G-XXXXXXXXXX`).
3. In `index.html`, replace both instances of `G-XXXXXXXXXX` with the real ID (they're in the `<head>`, in the `gtag` script block).
4. Commit and push — GA will start recording page views once live.

## 3. Mapbox token note

The Mapbox access token in `config.js` is on the free tier (50,000 map loads/month, no credit card required at that volume). Once this is live at `studiogwa.github.io/mpl-survey-map/` (and later, a custom domain), consider adding a URL restriction on the token in the Mapbox account dashboard (Tokens → this token → URL restrictions) scoped to those domains, so the token can't be reused elsewhere if it leaks.

## 4. Fonts (when provided)

`style.css` currently uses Google Fonts substitutes (Poppins for Gilroy, Lora for Surveyor Text) with commented-out `@font-face` blocks at the top of the file. Once the licensed Gilroy/Surveyor Text `.woff2` files are available, drop them in a `/fonts` folder, uncomment those blocks, and update the file paths to match the actual filenames.
