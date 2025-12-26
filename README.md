SAML Playground

Run locally:
1) npm install
2) Copy .env.example to .env and adjust values
3) npm start

Routes:
- /import : create a runtime connection by pasting IdP metadata URL or XML
- /c/<id> : connection details and copy/paste values
- /login/<id> : SP-initiated
- /launch/<id> : tile-friendly launch (no query string in the tile)
- /me : shows the current session profile
