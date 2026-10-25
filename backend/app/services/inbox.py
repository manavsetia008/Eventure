"""Forward an event email to inbox+<token>@yourdomain and it lands in the student's Inbox, parsed and waiting for confirmation."""
import hashlib
import html
import json
import re
from email import message_from_bytes, policy
from email.utils import getaddresses, parseaddr

TOKEN_RE = re.compile(r"\+([a-z0-9]{6,32})@", re.I)
FWD_MARKER = re.compile(r"^\s*-{2,}\s*(?:forwarded message|original message)\s*-{2,}\s*$", re.I)
HEADER_LINE = re.compile(r"^\s*(?:from|date|sent|to|cc|bcc|subject|reply-to):", re.I)
SUBJECT_PREFIX = re.compile(r"^(?:\s*(?:fwd?|re)\s*:\s*)+", re.I)


def html_to_text(raw):
    raw = re.sub(r"(?is)<(script|style).*?</\1>", " ", raw or "")
    raw = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</tr>|</li>|</h\d>", "\n", raw)
    raw = re.sub(r"(?s)<[^>]+>", " ", raw)
    text = html.unescape(raw)
    text = re.sub(r"[ \t\xa0]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    return re.sub(r"\n{2,}", "\n", text).strip()


def find_token(*address_fields):
    for field in address_fields:
        for _, addr in getaddresses([field or ""]):
            m = TOKEN_RE.search(addr or "")
            if m:
                return m.group(1).lower()
    return None


def clean_subject(subject):
    return SUBJECT_PREFIX.sub("", subject or "").strip()


def strip_forward_headers(body):
    """Drop the 'Forwarded message' banner and the From/Date/Subject block that follows it."""
    out, skipping = [], False
    for line in (body or "").splitlines():
        if FWD_MARKER.match(line):
            skipping = True
            continue
        if skipping and (HEADER_LINE.match(line) or not line.strip()):
            continue
        skipping = False
        out.append(line)
    return "\n".join(out).strip()


def build_text(subject, body):
    return f"{clean_subject(subject)}\n{strip_forward_headers(body)}".strip()


def parse_raw_email(raw: bytes):
    msg = message_from_bytes(raw, policy=policy.default)
    token = find_token(*(msg.get(h, "") for h in ("To", "Delivered-To", "X-Original-To", "Cc")))
    body = ""
    part = msg.get_body(preferencelist=("plain",))
    if part is not None:
        body = part.get_content()
    else:
        part = msg.get_body(preferencelist=("html",))
        if part is not None:
            body = html_to_text(part.get_content())
    return {
        "token": token,
        "subject": str(msg.get("Subject", "")).strip(),
        "sender": parseaddr(str(msg.get("From", "")))[1],
        "body": (body or "").strip(),
        "message_id": str(msg.get("Message-ID", "")).strip() or None,
    }


def forwarding_address(inbox_address, token):
    if not inbox_address or "@" not in inbox_address:
        return None
    local, domain = inbox_address.split("@", 1)
    return f"{local.split('+')[0]}+{token}@{domain}"


def ingest_email(config, token, subject, body, sender, message_id):
    """Create an InboxItem for the user that owns `token`. Returns the item, or None if unknown or duplicate."""
    from ..extensions import db
    from ..models import InboxItem, Notification, User
    from ..utils import now
    from .extraction import extract_event

    user = User.query.filter_by(inbox_token=token).first() if token else None
    if not user:
        return None
    mid = message_id or "h:" + hashlib.sha1(f"{sender}|{subject}|{(body or '')[:500]}".encode("utf-8")).hexdigest()
    if InboxItem.query.filter_by(user_id=user.id, message_id=mid).first():
        return None
    parsed = extract_event(build_text(subject, body), now(), config.get("ANTHROPIC_API_KEY") or None, config.get("ANTHROPIC_MODEL"))
    item = InboxItem(user_id=user.id, message_id=mid[:300], sender=(sender or "")[:300], subject=(subject or "")[:500],
                     body=(body or "")[:20000], parsed=json.dumps(parsed))
    db.session.add(item)
    db.session.flush()
    title = parsed.get("title") or clean_subject(subject) or "a new event"
    db.session.add(Notification(user_id=user.id, level="info", dedupe_key=f"inbox:{item.id}",
                                message=f"New in your Inbox: {title}. Review it and add it to your timeline."))
    db.session.commit()
    return item
