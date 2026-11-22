# Publish Pi Zero Lab

The site is a static build. It does not need Node or Python at runtime. Assets use relative URLs, and routes use a hash (`#/lessons`), so GitHub Pages can serve the `dist/` folder from `https://josephcake.github.io/pizero-lab/` without a rewrite rule.

## 1. Create the repository from source.zip

`source.zip` contains `main.bundle` (a git bundle of `main`) and a `tree/` directory (the working files, without `node_modules`, keys, or `.env`).

```bash
unzip source.zip -d pizero-src
cd pizero-src
git clone main.bundle pizero-lab
cd pizero-lab
git remote add origin git@github.com:josephcake/pizero-lab.git
git push -u origin main
```

If `git clone` of the bundle complains about a missing default branch:

```bash
git clone -b main main.bundle pizero-lab
```

## 2. Build

```bash
cd web
npm install
npx vite build
```

Output is `web/dist/`. `vite.config.js` sets `base: "./"`.

## 3. Deploy to GitHub Pages

### Option A — gh-pages branch

```bash
cd web/dist
git init
git checkout -b gh-pages
git add .
git commit -m "Publish Pi Zero Lab"
git remote add origin git@github.com:josephcake/pizero-lab.git
git push -u origin gh-pages
```

In the repository settings, set Pages to deploy from the `gh-pages` branch, folder `/` (root). The site is then:

https://josephcake.github.io/pizero-lab/

### Option B — Pages from Actions

Add `.github/workflows/pages.yml` on `main`:

```yaml
name: pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install
        working-directory: web
      - run: npx vite build
        working-directory: web
      - uses: actions/upload-pages-artifact@v3
        with:
          path: web/dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

In Settings → Pages, choose **GitHub Actions** as the source.

## README (put this at the repository root)

# Pi Zero Lab

A static learning bench for the Raspberry Pi Zero family. The live board is the Zero W. Other Zero models are listed and marked coming soon until their own geometry files exist.

Open `web/dist/index.html` via any static file server (do not rely on `file://`). From `web/`:

```bash
npm install
npx vite build
python3 -m http.server 4765 --directory dist
```

Then open http://127.0.0.1:4765/#/

Hardware numbers come from `data/boards/zero-w.flux.json` and `data/pinout.flux.json`. Positions are millimetres, origin bottom-left, y up, and are converted once when the page loads.
