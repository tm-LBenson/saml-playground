# SAML Playground (SP + IdP initiated)

This repo is a lightweight **SAML 2.0 Service Provider** you control, built for:
- practicing SAML configuration in an IdP (RapidIdentity, Okta, Entra ID, etc.)
- troubleshooting common SAML issues with a place to “wire up” quickly
- learning how the **SAMLRequest** and **SAMLResponse** look (decoded XML included)

It supports:
- ✅ **SP-initiated** login (you click “login” in the app)
- ✅ **IdP-initiated** login (you click a tile/app in the IdP portal; IdP posts to ACS)
- ✅ multiple connections (“tenants”) via `connections.json` — great for coworkers

> ⚠️ IdP-initiated SSO accepts unsolicited assertions. That’s fine for a playground, but in production you typically prefer SP-initiated + `InResponseTo` validation.

---

## 1) Prereqs

- Node.js **20+**
- A public HTTPS URL (for most IdPs). For local dev:
  - use **ngrok** or **Cloudflare Tunnel**
- Your IdP details:
  - IdP SSO URL (HTTP-Redirect / HTTP-POST endpoint)
  - IdP signing certificate (X.509 PEM)

---

## 2) Setup & run locally

```bash
# 1) Install dependencies
npm install

# 2) Create your config
cp connections.example.json connections.json

# 3) Create a local .env
cp .env.example .env
```

Edit `.env` and set:

- `BASE_URL` to your public HTTPS tunnel URL
  - e.g. `https://xxxxx.ngrok-free.app`

Start the server:

```bash
npm run dev
```

Open:

- http://localhost:3000 (local UI)
- The IdP will use **BASE_URL** for ACS & metadata links shown in the UI.

---

## 3) Configure RapidIdentity (generic SAML app steps)

Every IdP UI is different, but the required values are always the same:

### Service Provider values (from this app)

For a given connection id, for example `rapididentity-dev`, the app shows:

- **ACS URL**  
  `https://YOUR_BASE_URL/saml/acs/rapididentity-dev`

- **SP Entity ID / Issuer**  
  `https://YOUR_BASE_URL/saml/metadata/rapididentity-dev`

- **SP metadata URL** (optional import)  
  `https://YOUR_BASE_URL/saml/metadata/rapididentity-dev`

### IdP values (you copy into `connections.json`)

From RapidIdentity, collect:

- **IdP SSO URL** (login URL)
- **IdP signing certificate** (X.509 PEM)
- (optional) **IdP Entity ID**

Then put them into `connections.json`, e.g.

```json
[
  {
    "id": "rapididentity-dev",
    "displayName": "RapidIdentity (Dev)",
    "idpEntityId": "https://rapididentity.example.com/saml2",
    "idpSsoUrl": "https://rapididentity.example.com/saml2/sso",
    "idpCertPem": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n",
    "nameIdFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    "allowIdpInitiated": true
  }
]
```

### Recommended mappings in the IdP

- **NameID**: email address (or whatever you want to identify users)
- **Sign the assertion**: ✅ yes (almost always required)
- Attributes to include (optional):
  - `email`, `givenName`, `sn` / `surname`, `groups`

---

## 4) Try SP-initiated

1. Go to the home page.
2. Click **SP-initiated login** for your connection.
3. After login, you’ll be redirected back to `/me` and see:
   - parsed attributes (what passport-saml extracted)
   - decoded **SAMLRequest** (AuthnRequest)
   - decoded **SAMLResponse**

---

## 5) Try IdP-initiated

1. In the IdP portal, click the app tile that is configured to post to the ACS URL.
2. The IdP should POST `SAMLResponse` to:
   - `https://YOUR_BASE_URL/saml/acs/<connectionId>`
3. If the IdP sends `RelayState`, this app will redirect there **only if it’s safe**:
   - relative paths like `/me` are always allowed
   - full URLs must match `ALLOWED_RELAYSTATE_ORIGINS` (env var)

---

## 6) Troubleshooting hints

### “Invalid signature” / “Cannot validate signature”
- Wrong IdP cert in `connections.json` (copy the signing cert, not the encryption cert).
- Assertion not signed, but SP expects signed assertions.

### “Audience is invalid”
- Audience in assertion doesn’t match SP Entity ID.
- Try setting your IdP “Audience URI / SP Entity ID” to the metadata URL shown in the UI.

### Clock / NotBefore / NotOnOrAfter issues
- Check server time.
- Adjust skew by changing `acceptedClockSkewMs` in `src/server.js`.

---

## 7) Share with coworkers (multi-tenant)

Add a new object to `connections.json` per coworker/customer IdP config:

- give each connection a unique `"id"`
- each connection gets its own ACS + Entity ID endpoints automatically

Then redeploy.

---

## 8) Deploy (Cloud Run - simplest “always on”)

> You can deploy anywhere that can run Node/Express. Cloud Run is quick for teams.

### Build & deploy

```bash
gcloud run deploy saml-playground \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars BASE_URL=https://YOUR_CLOUD_RUN_URL,SESSION_SECRET=change-me,TRUST_PROXY=1
```

After deploy:
- set a **custom domain** (recommended)
- update `BASE_URL` to your custom domain
- update IdP ACS/EntityID if the hostname changed

---

## Security notes (for internal playgrounds)

- Don’t use real production IdP certificates/accounts unless allowed.
- Consider restricting access (IAP, IP allowlist, basic auth, VPN) if deployed publicly.
- IdP-initiated flow is less secure by design; keep it for learning.
