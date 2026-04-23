SAML Playground

Run:
  cp .env.example .env
  npm install
  npm start

Notes:
  - Metadata now advertises both POST (default) and Redirect ACS bindings.
  - POST callbacks at /saml/acs/:connection are processed by passport-saml.
  - GET callbacks at /saml/acs/:connection are captured and decoded for inspection.
    This is useful for testing nonstandard Redirect-bound SAML responses, but it is
    a debug path, not a full browser-SSO login flow.
