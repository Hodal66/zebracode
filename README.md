# ZEBRACODE

Marketing website for **ZEBRACODE**, a Kigali-based digital products, design and technology company.

A dependency-free static site: a single `index.html` (HTML, CSS, vanilla JS), with a brand logo animation in the hero.

## Run locally
```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

## Deploy
Every push to `main` deploys to GitHub Pages through `.github/workflows/pages.yml`.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Configure
- `WHATSAPP_NUMBER` in the script at the bottom of `index.html` (digits with country code) shows the floating WhatsApp button.
- Contact and quote forms open the visitor's email app (`mailto:`); there is no backend.
