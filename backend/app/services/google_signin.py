"""Sign in with Google using the server-side Authorization Code flow with PKCE.

Only the OpenID basics are requested (email + profile). The ID token returned by Google is
verified against Google's public keys before it is trusted: issuer, audience (our client id),
expiry and signature.

Reuses the same OAuth client as the Calendar sync (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET);
the redirect URI is APP_BASE_URL/auth/google/callback.
"""
import base64
import hashlib
import secrets
from urllib.parse import urlencode

import jwt
import requests

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
SCOPE = "openid email profile"
ISSUERS = ("https://accounts.google.com", "accounts.google.com")
_jwks_client = None


def configured(config):
    return bool(config.get("GOOGLE_CLIENT_ID") and config.get("GOOGLE_CLIENT_SECRET"))


# ---------- PKCE ----------
def make_verifier():
    return secrets.token_urlsafe(64)


def challenge(verifier):
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


# ---------- OAuth ----------
def build_auth_url(config, state, code_challenge):
    params = {
        "client_id": config["GOOGLE_CLIENT_ID"],
        "redirect_uri": config["GOOGLE_LOGIN_REDIRECT_URI"],
        "response_type": "code",
        "scope": SCOPE,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{AUTH_URL}?{urlencode(params)}"


def exchange_code(config, code, code_verifier):
    r = requests.post(TOKEN_URL, data={
        "code": code,
        "client_id": config["GOOGLE_CLIENT_ID"],
        "client_secret": config["GOOGLE_CLIENT_SECRET"],
        "redirect_uri": config["GOOGLE_LOGIN_REDIRECT_URI"],
        "grant_type": "authorization_code",
        "code_verifier": code_verifier,
    }, timeout=15)
    r.raise_for_status()
    return r.json()


def _client():
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(CERTS_URL)
    return _jwks_client


def verify_id_token(config, id_token, client=None):
    """Return the verified claims, or raise if the token is not a valid Google ID token."""
    if not id_token:
        raise ValueError("missing id token")
    signing_key = (client or _client()).get_signing_key_from_jwt(id_token)
    claims = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=config["GOOGLE_CLIENT_ID"],
        options={"require": ["exp", "aud", "iss"]},
    )
    if claims.get("iss") not in ISSUERS:
        raise ValueError("unexpected issuer")
    return claims


def email_verified(claims):
    return str(claims.get("email_verified", "")).lower() == "true"
