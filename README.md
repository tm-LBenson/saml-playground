# SAML Playground (minimal)

A small, single-instance SAML **Service Provider** (SP) you can use to practice configuring SAML.

## What it supports

- **SP-initiated** login: `GET /login/:connectionId`
- **IdP-initiated** login: IdP posts to `POST /saml/acs/:connectionId`
- Import IdP metadata via **URL or XML** at `/import`
- Multiple connections at once (in-memory, auto-expire)

## Run locally

```bash
cp .env.example .env
# Edit BASE_URL for local if you want (defaults to http://localhost:PORT)
npm install
npm start
```

Then open:

- Home: http://localhost:3000
- Import: http://localhost:3000/import

## Deploy to Render

- **Build command**: `npm install`
- **Start command**: `npm start`
- Add environment variables:
  - `BASE_URL` = `https://<your-service>.onrender.com`
  - `SESSION_SECRET` = a long random value
  - `TRUST_PROXY` = `1`

## Notes

- Connections are stored in-memory. If your instance restarts, you may need to re-import metadata.
- Cookies use `SameSite=None; Secure` automatically when `BASE_URL` is https, so SAML POSTs can carry the session cookie.
