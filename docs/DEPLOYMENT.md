# Deployment

VNTax.ai is a static Vite SPA. It uses `HashRouter`, so **no SPA rewrite rule is needed** on any host — every route lives behind `#`, and the server only ever serves `/index.html`.

## Hosts

| Host | URL | Status |
|---|---|---|
| Vercel (production) | `vntax-ai.vercel.app` | Working |
| Vercel (duplicate) | `vntax-ai-prqw.vercel.app` | Working, redundant |
| Cloudflare Pages | `vntax-ai.pages.dev` | Fixed by this change |

## What was broken on Cloudflare Pages

The Pages project had **no build command configured**, so Cloudflare published the repository root as static assets. The file that went live was the raw source `index.html`, whose only script tag is:

```html
<script type="module" src="/src/main.tsx"></script>
```

Browsers cannot execute TypeScript. There was no bundler step, so `/src/main.tsx` was served as-is and the page rendered blank — a 200 response with an empty `<div id="root">`. This is why the site "did not work" while still appearing to be up.

A second latent problem: Cloudflare's v1 build image defaults to **Node 12.18.0**, and v2 to 18.17.1. This project requires Node `>=20.19.0` (Vite 7). Even with a build command set, an unpinned older build image would have failed.

## The fix

Three repo-side changes plus one CI workflow:

1. **`wrangler.toml`** — sets `pages_build_output_dir = "./dist"`. Once deployed, this file becomes the source of truth for the output directory and the matching dashboard field goes read-only.
2. **`.node-version`** — pins `22.16.0`, matching Cloudflare's v3 build image default and satisfying the `engines` floor.
3. **`public/_headers`** — security headers plus correct caching. Vite copies `public/` into `dist/`, so this ships with the build.
4. **`.github/workflows/deploy-cloudflare-pages.yml`** — builds in CI and direct-uploads `dist/` to Pages.

### Why CI direct-upload rather than Cloudflare's Git integration

Cloudflare's build command **cannot** be set in `wrangler.toml` — only in the dashboard or via the API. That makes it invisible to code review and free to drift, which is precisely the failure that took the site down. Moving the build into GitHub Actions puts it under version control, gates it behind the existing 134-test suite, and fixes the separate known annoyance that pushes were not reliably triggering rebuilds.

The workflow also asserts that `dist/index.html` no longer references `/src/main.tsx` before publishing, so this specific failure cannot ship again silently.

### Required secrets

Add under **Settings → Secrets and variables → Actions**:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token, with the **Cloudflare Pages: Edit** permission |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard URL, or the Workers & Pages overview page |

### If you keep the dashboard Git integration instead

Set the **React (Vite)** preset: build command `npm run build`, build output directory `dist`. If you do this, disable the GitHub Actions workflow to avoid two systems deploying to the same project.

## Worth considering

Cloudflare Pages and Vercel are both serving the same static SPA. Unless Cloudflare is here for a specific reason (a domain already on Cloudflare DNS, or WAF), maintaining two hosts doubles the deploy surface for no benefit — the duplicate `vntax-ai-prqw` Vercel project has the same issue. Consolidating to one host would remove a class of "which URL is current?" confusion.
