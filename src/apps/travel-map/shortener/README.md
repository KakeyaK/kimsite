# Invite link shortener

`go.kakeya.kim/Ab3dE9x` → a long invite link. A Cloudflare Worker (`worker.ts`) with a KV store, on Cloudflare's
free plan. It isn't part of the Astro build: it's deployed on its own, by hand, and only when `worker.ts` changes.

- `POST /` with `{"url": "…"}` stores an invite and answers `{"url": "https://go.kakeya.kim/<code>"}`. Only links
  starting with `https://www.kakeya.kim/sandbox/travel-map/invite#` are taken, so the domain can't front spam.
- `GET /<code>` redirects to the invite, `#…` included.
- The trip planner's "Shorten link" button calls it (`lib/shortLink.ts`). If it fails, the planner keeps the full
  link, which always works.

Short links store the invite on Cloudflare, unlike full links, whose `#…` never leaves the browser. Free-plan limits
(check Cloudflare's pricing page): 100k redirects and 1,000 new links a day.

## Setup (once)

### 1. Move the domain's DNS to Cloudflare

The domain stays registered (and paid for) at Porkbun; only its DNS moves. A Worker can serve `go.kakeya.kim` only if
Cloudflare runs the DNS for `kakeya.kim`.

1. Make a free Cloudflare account, then **Connect a domain** → `kakeya.kim` → Free plan (not "Transfer": that would move the registration away from Porkbun).
2. Cloudflare copies the existing records. Before going on, compare them with Porkbun's DNS page (Domain Management →
   DNS) and add anything missing. The site needs:
   - `CNAME www → kakeyak.github.io`
   - for the bare `kakeya.kim`, GitHub Pages' `A` records (185.199.108.153 to 185.199.111.153) or an `ALIAS`,
     whatever Porkbun has today
   - any `MX`/`TXT` records (email forwarding, domain verifications)

   Set the GitHub Pages records to **DNS only** (grey cloud), so GitHub keeps renewing the site's HTTPS certificate.
3. At Porkbun: if DNSSEC is on, turn it off first. Then, in the domain's **Authoritative Nameservers**, replace
   Porkbun's with the two Cloudflare shows you.
4. Wait for Cloudflare's "your domain is active" email (minutes to a few hours). The site keeps working throughout.
   You can turn DNSSEC back on from Cloudflare afterwards.

### 2. Deploy the Worker

```sh
npx wrangler@4 login
npx wrangler@4 kv namespace create LINKS   # paste the printed id into wrangler.toml
npm run shortener:deploy
```

`custom_domain = true` in `wrangler.toml` makes Cloudflare create the `go` DNS record and its certificate. Check with
`curl -i https://go.kakeya.kim/` (a redirect to the site), then try "Shorten link" in the trip planner on the live site.
To use another name than `go`, change it in `wrangler.toml` and `lib/shortLink.ts`.
