# Brand Asset Map

This repository uses fixed public asset paths so brand images can be uploaded manually without changing integration code.

## Folder layout
- `genlayer/`: GenLayer or partner badges and ecosystem marks
- `logos/`: application logos and favicon
- `images/`: hero and other content images
- `og/`: Open Graph image(s)

## Canonical files
- `logos/logo-light.svg`
- `logos/logo-dark.svg`
- `logos/favicon.ico`
- `images/hero.png`
- `og/og-image.png`

Keep filenames stable to avoid breaking references in app/front-end integration layers.

## How to upload and use your own images
1. Put your image files in `public/assets/...` (for example `public/assets/logos/logo-light.svg`).
2. Reference them in React/Next with an absolute path from `/assets/...` (example: `/assets/logos/logo-light.svg`).
3. Restart `npm run dev` if the image does not refresh immediately.

Current placeholders committed in this repo:
- `/assets/logos/logo-light.svg`
- `/assets/genlayer/genlayer-wordmark.svg`
