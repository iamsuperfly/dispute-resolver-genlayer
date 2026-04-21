# AI Dispute Resolver on GenLayer

A simple **Intelligent Contract** that acts as a decentralized AI judge on GenLayer Bradbury testnet.

## Features
- Submit any claim + evidence
- AI (LLM) analyzes and returns a verdict: `guilty`, `not_guilty`, or `insufficient_evidence`
- Returns a short, clear reason
- Uses GenLayer's Equivalence Principle for AI consensus

## Contract Address
`0xDC1445Ea646CcD2900FdEcA86ba7597E9412B14F`

## Studio Link (Live)
https://studio.genlayer.com/?import-contract=0xDC1445Ea646CcD2900FdEcA86ba7597E9412B14F

## How to Test
1. Open the Studio link above
2. Call `submit_dispute(claim, evidence)`
3. View result with `get_verdict()`

## Brand Assets
Brand assets are stored in `public/assets/` and intentionally committed as tracked empty directories so you can manually upload production images without changing code paths.

### Asset directories
- `public/assets/genlayer/` (GenLayer-specific partner/brand assets)
- `public/assets/logos/` (app logos + favicon)
- `public/assets/images/` (hero and in-app marketing/supporting images)
- `public/assets/og/` (Open Graph/social sharing images)

### Expected filenames
- `public/assets/logos/logo-light.svg`
- `public/assets/logos/logo-dark.svg`
- `public/assets/logos/favicon.ico`
- `public/assets/images/hero.png`
- `public/assets/og/og-image.png`
- `public/assets/genlayer/partner-badge-*.svg` (or `.png` for raster badges)

### Recommended dimensions and formats
- `logo-light` / `logo-dark`: SVG preferred (or PNG at 1024px+ width, transparent background)
- `favicon`: ICO preferred (`32x32` minimum, include multi-size if available)
- `hero image`: PNG or WebP, recommended `1600x900` (16:9), optimized for web
- `OG image`: PNG/JPG, exactly `1200x630` for consistent social previews
- `partner/badge logos`: SVG preferred; if PNG, provide at least `512px` wide

### Where each asset appears in the app
- `logo-light`: light-theme header/nav branding
- `logo-dark`: dark-theme header/nav branding
- `favicon`: browser tab/app icon
- `hero image`: landing/demo hero section
- `OG image`: social preview metadata (`og:image`)
- `partner/badge logos`: partner strip, footer badges, ecosystem acknowledgements

### Post-upload checklist
- [ ] `logo-light` uploaded (`public/assets/logos/logo-light.svg`)
- [ ] `logo-dark` uploaded (`public/assets/logos/logo-dark.svg`)
- [ ] `favicon` uploaded (`public/assets/logos/favicon.ico`)
- [ ] `hero image` uploaded (`public/assets/images/hero.png`)
- [ ] `OG image` uploaded (`public/assets/og/og-image.png`)
- [ ] Any partner/badge logos uploaded (`public/assets/genlayer/`)

## Demo Video
[Watch Demo] https://youtu.be/L3O3FgOfS3A

Built by **Superfly** (@killsh0tx)

Submitted for the GenLayer Bradbury Hackathon 2026.
