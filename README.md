# Paynter Bar — Reorder Planner

Web dashboard for GemLife Palmwoods bar stock management.
Pulls live data from Square POS, calculates reorder quantities,
and lets you edit pack sizes, suppliers and categories in-browser.

## Features
- Live Square inventory and 90-day sales data
- Auto-calculated order quantities per item
- Editable pack sizes, categories and suppliers (saved to Vercel KV)
- Per-supplier order views (Dan Murphys, Coles Woolies, ACW)
- Adjustable target stock weeks
- Critical / Low / OK priority flags
- No login required — private URL is sufficient

## Deploy to Vercel

### 1. Push to GitHub
Create a new repo called `paynter-bar-reorder` on GitHub and push this folder.

### 2. Import to Vercel
- Go to vercel.com → Add New Project
- Import the GitHub repo
- Framework: Next.js (auto-detected)

### 3. Add KV Storage
- In Vercel dashboard → Storage → Create KV Database
- Name: paynter-bar-kv
- Connect to your project

### 4. Set Environment Variables
In Vercel project settings → Environment Variables, add:
- `SQUARE_ACCESS_TOKEN` = your Square production access token

### 5. Deploy
Vercel will build and deploy automatically.
Every push to main triggers a redeploy.

## Local Development
```
npm install
# create .env.local with:
# SQUARE_ACCESS_TOKEN=your_token_here
# KV_URL=...  (from Vercel KV)
# KV_REST_API_URL=...
# KV_REST_API_TOKEN=...
npm run dev
```
