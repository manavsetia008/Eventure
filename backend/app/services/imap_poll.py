"""Poll a mailbox over IMAP for forwarded events (works with Gmail plus-addressing and an app password)."""
import imaplib
import logging

from .inbox import ingest_email, parse_raw_email


def poll_inbox(app):
    """Read unseen mails and create inbox items. Returns how many were created."""
    cfg = app.config
    if not cfg.get("IMAP_HOST"):
        return 0
    created = 0
    with app.app_context():
        try:
            box = imaplib.IMAP4_SSL(cfg["IMAP_HOST"], cfg["IMAP_PORT"])
            box.login(cfg["IMAP_USER"], cfg["IMAP_PASSWORD"])
            box.select("INBOX")
            status, data = box.search(None, "UNSEEN")
            numbers = data[0].split() if status == "OK" and data and data[0] else []
            for num in numbers:
                status, msgdata = box.fetch(num, "(RFC822)")  # fetching marks the mail as read
                if status != "OK" or not msgdata or not msgdata[0]:
                    continue
                mail = parse_raw_email(msgdata[0][1])
                if ingest_email(cfg, mail["token"], mail["subject"], mail["body"], mail["sender"], mail["message_id"]):
                    created += 1
            box.logout()
        except Exception as exc:
            logging.warning("Inbox polling failed: %s", exc)
    return created
