# Invite link shortener

`go.kakeya.kim/Ab3dE9x` → an invite. A Cloudflare Worker (`worker.ts`) with a KV store, on Cloudflare's free plan. It
isn't part of the Astro build: it's deployed on its own, by hand, and only when `worker.ts` changes.

Every invite is shared this way: the trip planner's "Create link" button stores the invite and shows only its short
link. Since the full link is never pasted anywhere, an invite can be long (a message of up to `MAX_MESSAGE`
characters in `lib/invite.ts`).

- `POST /` with `{"invite": "i=…"}` (what `encodeInvite` makes) stores it and answers
  `{"url": "https://go.kakeya.kim/<code>"}`. Anything that isn't an invite is refused, and the Worker only ever
  sends visitors to the invite page, so the domain can't front spam.
- `GET /<code>` sends the browser to `https://www.kakeya.kim/sandbox/travel-map/invite#i=…`: a 302, or, for an
  invite whose link is longer than `MAX_REDIRECT`, a tiny page that forwards it (Cloudflare caps header sizes).

The same invite always gets the same code. Invites are stored on Cloudflare, so anyone with a code can read its
invite. Free-plan limits (check Cloudflare's pricing page): 100k opened invites and 1,000 new ones a day. On the dev
server, which the shortener doesn't answer, the planner falls back to a full link.

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
`curl -i https://go.kakeya.kim/` (a redirect to the site), then try "Create link" in the trip planner on the live site.
To use another name than `go`, change it in `wrangler.toml` and `lib/shortLink.ts`.
