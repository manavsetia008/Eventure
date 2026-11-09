import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# ── Output path ──────────────────────────────────────────────────────────────
output_path = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', 'Eventure_Full_Documentation.pdf')
)

# ── Styles ───────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

styles.add(ParagraphStyle(
    name='DocTitle',
    fontSize=22, leading=28, alignment=TA_CENTER,
    textColor=colors.HexColor('#1a237e'), spaceAfter=6, fontName='Helvetica-Bold'
))
styles.add(ParagraphStyle(
    name='Subtitle',
    fontSize=11, leading=14, alignment=TA_CENTER,
    textColor=colors.HexColor('#555555'), spaceAfter=18
))
styles.add(ParagraphStyle(
    name='SectionHead',
    fontSize=14, leading=18, alignment=TA_LEFT,
    textColor=colors.HexColor('#1a237e'), spaceAfter=6, spaceBefore=14,
    fontName='Helvetica-Bold'
))
styles.add(ParagraphStyle(
    name='SubHead',
    fontSize=11, leading=14, alignment=TA_LEFT,
    textColor=colors.HexColor('#4a148c'), spaceAfter=4, spaceBefore=8,
    fontName='Helvetica-Bold'
))
styles.add(ParagraphStyle(
    name='Body',
    fontSize=10, leading=14, alignment=TA_LEFT,
    textColor=colors.HexColor('#212121'), spaceAfter=5
))
styles.add(ParagraphStyle(
    name='BulletItem',
    fontSize=10, leading=14, alignment=TA_LEFT,
    textColor=colors.HexColor('#212121'), spaceAfter=4,
    leftIndent=16, bulletIndent=4
))
styles.add(ParagraphStyle(
    name='GapHead',
    fontSize=10, leading=13, alignment=TA_LEFT,
    textColor=colors.HexColor('#b71c1c'), spaceAfter=2,
    fontName='Helvetica-Bold'
))

def HR():
    return HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#b0bec5'), spaceAfter=6, spaceBefore=6)

def section(title):
    return [HR(), Paragraph(title, styles['SectionHead'])]

def sub(title):
    return Paragraph(title, styles['SubHead'])

def body(text):
    return Paragraph(text, styles['Body'])

def bullet(text):
    return Paragraph(f"• {text}", styles['BulletItem'])

def gap_head(text):
    return Paragraph(text, styles['GapHead'])

story = []

# ══ TITLE ════════════════════════════════════════════════════════════════════
story.append(Spacer(1, 0.4*cm))
story.append(Paragraph('EVENTURE', styles['DocTitle']))
story.append(Paragraph('Smart College Event & Hackathon Management Platform', styles['Subtitle']))
story.append(Paragraph('Complete Documentation – Presentation, Q&A &amp; Research Reference', styles['Subtitle']))
story.append(HR())
story.append(Spacer(1, 0.3*cm))

# ══ TEAM ════════════════════════════════════════════════════════════════════
story += section('1. Team Members & Roles')
story.append(body(
    'Yeh humari teen-member team hai. Neeche har ek ka main contribution likha hai '
    'taaki presentation ke time clearly explain kar sako:'
))

team_data = [
    ['Member', 'Domain', 'What They Built'],
    ['Manav', 'Flask Backend', 'App server setup, SQLite database models (Events, Reviews, Users),\nAPI route handlers, Tesseract OCR endpoint (/ocr), seed data script'],
    ['Mayank', 'API Design & Integration', 'REST API architecture, authentication (JWT tokens),\nrequest/response schemas, frontend-backend integration, .env config'],
    ['Milan', 'Frontend (React)', 'All UI pages (Discover, Timeline, Community, Login, Settings),\nComponent design (EventForm, IssueCard, MapView), CSS styling, PWA setup'],
]
t = Table(team_data, colWidths=[3.5*cm, 4*cm, 9.5*cm])
t.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1a237e')),
    ('TEXTCOLOR', (0,0), (-1,0), colors.white),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0), (-1,-1), 9),
    ('GRID', (0,0), (-1,-1), 0.4, colors.HexColor('#b0bec5')),
    ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f5f5f5')),
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#e8eaf6')]),
]))
story.append(t)
story.append(Spacer(1, 0.3*cm))

# ══ PROBLEM ════════════════════════════════════════════════════════════════════
story += section('2. Problem Statement')
story.append(body(
    'College students aur hackathon organizers ko event management mein <b>3 major pain points</b> face karne padte hain:'
))
story.append(bullet('<b>Scheduling conflicts:</b> Exams ke time bhi events schedule ho jaate hain. Koi tool automatically exam weeks detect karke shield nahi karta.'))
story.append(bullet('<b>No travel intelligence:</b> Offline events ke liye travel time / buffer ka koi hisaab nahi hota. Students late pounch jaate hain ya miss karte hain.'))
story.append(bullet('<b>Fake / unverified reviews:</b> Existing platforms par koi bhi kisi bhi event ka review de sakta hai, chahe wo gaya hi na ho. Yeh trust ko damage karta hai.'))
story.append(bullet('<b>Flat, single-stage view:</b> Hackathons mein registration, shortlisting, round 1, round 2, finals hoti hain — existing tools sirf ek single event entry show karte hain, koi multi-stage tracker nahi.'))
story.append(bullet('<b>No smart scoring:</b> Organizers ke paas koi automated "worth attending?" score nahi hota jo distance, timing, reviews, aur past participation sab ko weigh kare.'))

# ══ EXISTING TOOLS — DEEP GAP ANALYSIS ══════════════════════════════════════
story += section('3. Existing Tools & Deep Gap Analysis')
story.append(body(
    'Humne 6 major platforms research kiye jinka use college students aur hackathon organizers karte hain. '
    'Neeche har tool ka detailed breakdown hai — kya karta hai, aur <b>specifically Eventure se kya alag hai.</b>'
))

# ── Unstop ──────────────────────────────────────────────────────────────────
story.append(sub('3.1  Unstop (formerly Dare2Compete)'))
story.append(body(
    '<b>What it does:</b> India ka sabse popular hackathon listing platform. '
    'Teams register karti hain, organizers events post karte hain, aur results announce kiye jaate hain.'
))
story.append(gap_head('GAPS vs Eventure:'))
story.append(bullet('<b>No multi-stage tracker:</b> Agar hackathon mein Round 1 → Round 2 → Grand Finale hai, toh Unstop sirf ek single event card dikhata hai. Students ko manually yaad rakhna padta hai kaunsa round kab hai.'))
story.append(bullet('<b>No exam-week shielding:</b> Agar aapki university mein mid-sems chal rahe hain aur koi event schedule ho, Unstop ko kuch pata nahi. Eventure apne calendar mein exam weeks mark karta hai aur conflict hone par warning deta hai.'))
story.append(bullet('<b>No travel buffer:</b> Offline events ke liye Unstop sirf venue show karta hai. Travel time, cab booking reminder, ya "leave by X time" jaise features nahi hain.'))
story.append(bullet('<b>Open reviews:</b> Koi bhi event ka review de sakta hai without proof of attendance. Eventure mein review tab hi unlock hota hai jab QR-based attendance verify ho jaaye.'))
story.append(bullet('<b>No personalized scoring:</b> Unstop sab ko same events dikhata hai. Eventure ek <i>keep-or-skip score</i> calculate karta hai based on your past events, location, skill tags, aur review sentiment.'))

story.append(Spacer(1, 0.2*cm))

# ── Devfolio ─────────────────────────────────────────────────────────────────
story.append(sub('3.2  Devfolio'))
story.append(body(
    '<b>What it does:</b> Developer-focused hackathon platform, primarily online hackathons. '
    'GitHub integration, project submission, judging tools provide karta hai.'
))
story.append(gap_head('GAPS vs Eventure:'))
story.append(bullet('<b>Online-only focus:</b> Devfolio mainly online hackathons ke liye hai. Physical / hybrid events ke liye travel planning, venue maps, offline fallback — kuch nahi.'))
story.append(bullet('<b>No scheduling intelligence:</b> Event listing hai, par smart scheduling (exam weeks, local holidays, college calendars) nahi. Students manually check karte hain.'))
story.append(bullet('<b>No stage-aware timeline:</b> Multi-round hackathons ke liye sirf submission deadline show hoti hai. Intermediate rounds track karne ka koi mechanism nahi.'))
story.append(bullet('<b>Trust gap:</b> Project ratings judge-driven hain, community peer reviews ka koi verified system nahi. Post-event verified reviews exist hi nahi karte.'))
story.append(bullet('<b>No conflict detection:</b> Agar do hackathons overlapping dates par hain jisme aapne dono register kiya hai, Devfolio koi alert nahi deta.'))

story.append(Spacer(1, 0.2*cm))

# ── Google Calendar ───────────────────────────────────────────────────────────
story.append(sub('3.3  Google Calendar / Outlook Calendar'))
story.append(body(
    '<b>What it does:</b> General-purpose calendar. Students manually events add karte hain, reminders set karte hain.'
))
story.append(gap_head('GAPS vs Eventure:'))
story.append(bullet('<b>Completely manual:</b> Har event manually enter karna padta hai. Eventure auto-imports events from links/QR, aur bulk-adds multi-stage hackathon rounds in one go.'))
story.append(bullet('<b>No hackathon context:</b> Calendar ko nahi pata ki yeh event ek hackathon ka Round 1 hai ya sirf ek seminar. Eventure events ko type, stage, aur priority se categorize karta hai.'))
story.append(bullet('<b>No travel intelligence:</b> Calendar sirf time show karta hai. Eventure Google Maps API se travel time fetch karta hai aur "depart by" reminder automatically set karta hai.'))
story.append(bullet('<b>No review/rating system:</b> Calendar ke andar kisi event ka feedback store karna ya doosron ke saath share karna possible nahi hai.'))
story.append(bullet('<b>No conflict scoring:</b> Calendar sirf conflict flag karta hai (red overlap). Eventure decide karta hai kaunsa event <i>worth keeping</i> hai based on your profile.'))

story.append(Spacer(1, 0.2*cm))

# ── Meetup / Eventbrite ───────────────────────────────────────────────────────
story.append(sub('3.4  Meetup / Eventbrite'))
story.append(body(
    '<b>What it does:</b> Public event discovery platforms. Local tech meetups, workshops, conferences list karte hain. '
    'Ticket booking aur RSVP functionality provide karte hain.'
))
story.append(gap_head('GAPS vs Eventure:'))
story.append(bullet('<b>Not college-aware:</b> Dono platforms general public ke liye hain. College academic calendar, semester schedule, ya hostel curfew jaise constraints ka koi concept nahi.'))
story.append(bullet('<b>No hackathon-specific features:</b> Team formation, submission deadlines, multi-round progression — koi support nahi. Sirf RSVP / ticket system hai.'))
story.append(bullet('<b>Paid events only focus:</b> Eventbrite mainly paid events ke liye design hua hai. College hackathons mostly free hote hain, aur free tier mein features bahut limited hain.'))
story.append(bullet('<b>Open reviews, no verification:</b> Dono platforms par reviews unverified hain. Bot reviews aur fake ratings common problem hai.'))
story.append(bullet('<b>No offline support:</b> Poor mobile experience when network is slow. Eventure ek PWA hai with service worker caching — offline bhi basic info available rehti hai.'))

story.append(Spacer(1, 0.2*cm))

# ── WhatsApp / Telegram groups ────────────────────────────────────────────────
story.append(sub('3.5  WhatsApp / Telegram Groups (Current Reality)'))
story.append(body(
    '<b>What it does:</b> Majority of college hackathon announcements aaj bhi WhatsApp groups par hote hain — '
    'screenshots of PDFs, Google Forms for registration, aur verbal reminders.'
))
story.append(gap_head('GAPS vs Eventure:'))
story.append(bullet('<b>No structured data:</b> Event details unstructured text mein hain — koi searchable database nahi, koi filter nahi.'))
story.append(bullet('<b>No reminders:</b> Group me message dab jaata hai. Important deadlines miss ho jaati hain. Eventure automated reminders push karta hai.'))
story.append(bullet('<b>No history:</b> Past events, apne results, ya portfolio — kuch bhi persist nahi hota. Eventure ek permanent event history maintain karta hai per user.'))
story.append(bullet('<b>Zero analytics:</b> Organizers ko pata nahi ki kitne log actually attend kiye, sentiments kya the, ya next event kab karna chahiye.'))
story.append(bullet('<b>No OCR intelligence:</b> Event flyers/PDFs WhatsApp par share hote hain but manually padhne padte hain. Eventure ka Tesseract OCR endpoint in images se automatically event details extract karta hai.'))

story.append(Spacer(1, 0.2*cm))

# ── HackerEarth ───────────────────────────────────────────────────────────────
story.append(sub('3.6  HackerEarth'))
story.append(body(
    '<b>What it does:</b> Competitive programming aur company-hosted hackathons ke liye platform. '
    'Code judge, leaderboard, aur challenge management provide karta hai.'
))
story.append(gap_head('GAPS vs Eventure:'))
story.append(bullet('<b>Company-centric, not student-centric:</b> HackerEarth mostly corporate hackathons ke liye design hua hai (recruitment-driven). College peer events ke liye not suitable.'))
story.append(bullet('<b>No physical event support:</b> Venue, map, travel time — koi concept nahi. Pure online coding challenges ke liye hai.'))
story.append(bullet('<b>No personalized timeline:</b> Platform sab participants ko same view dikhata hai. Individual student ki class schedule, exam dates, ya past participation track nahi hoti.'))
story.append(bullet('<b>No community trust layer:</b> Reviews sirf internal judges se aate hain. Public community-driven verified reviews exist nahi karte.'))

# ══ MASTER COMPARISON TABLE ═══════════════════════════════════════════════════
story += section('4. Feature Comparison Matrix')
story.append(body('Concise side-by-side — ek nazar mein sab kuch:'))

headers = ['Feature', 'Unstop', 'Devfolio', 'GCal', 'Meetup', 'WhatsApp', 'HackerEarth', 'EVENTURE']
rows = [
    ['Multi-stage hackathon tracker', 'x', 'x', 'x', 'x', 'x', 'x', 'YES'],
    ['Exam-week conflict shield', 'x', 'x', 'x', 'x', 'x', 'x', 'YES'],
    ['Travel time + depart reminder', 'x', 'x', 'x', 'x', 'x', 'x', 'YES'],
    ['Verified post-attendance review', 'x', 'x', 'x', 'x', 'x', 'x', 'YES'],
    ['Bayesian trust rating', 'x', 'x', 'x', 'x', 'x', 'x', 'YES'],
    ['Keep-or-skip smart scoring', 'x', 'x', 'x', 'x', 'x', 'x', 'YES'],
    ['OCR event flyer import', 'x', 'x', 'x', 'x', 'x', 'x', 'YES'],
    ['Offline PWA support', 'x', 'x', 'x', 'x', 'x', 'x', 'YES'],
    ['Duplicate/overlap conflict alert', 'Partial', 'x', 'Partial', 'x', 'x', 'x', 'YES'],
    ['College calendar awareness', 'x', 'x', 'x', 'x', 'x', 'x', 'YES'],
    ['Community issues/bug reporting', 'x', 'x', 'x', 'x', 'x', 'x', 'YES'],
    ['Organizer analytics dashboard', 'Partial', 'Partial', 'x', 'Partial', 'x', 'Partial', 'YES'],
]

col_widths = [5*cm, 1.4*cm, 1.6*cm, 1.2*cm, 1.5*cm, 2*cm, 2.3*cm, 2.3*cm]
table_data = [headers] + rows
ct = Table(table_data, colWidths=col_widths)

eventure_col = len(headers) - 1
ct.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1a237e')),
    ('TEXTCOLOR', (0,0), (-1,0), colors.white),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0), (-1,-1), 7.5),
    ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#b0bec5')),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#e8eaf6')]),
    ('ALIGN', (1,0), (-1,-1), 'CENTER'),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('BACKGROUND', (eventure_col, 1), (eventure_col, -1), colors.HexColor('#e8f5e9')),
    ('TEXTCOLOR', (eventure_col, 1), (eventure_col, -1), colors.HexColor('#1b5e20')),
    ('FONTNAME', (eventure_col, 1), (eventure_col, -1), 'Helvetica-Bold'),
    ('TEXTCOLOR', (1,1), (eventure_col-1,-1), colors.HexColor('#b71c1c')),
]))
story.append(ct)
story.append(Spacer(1, 0.3*cm))

# ══ WHAT WE BUILT — TECHNICAL ═════════════════════════════════════════════════
story += section('5. What We Actually Built — Technical Details')

story.append(sub('5.1 Tesseract OCR Integration'))
story.append(body(
    'Yeh humari ek <b>key unique feature</b> hai. College events mostly image flyers ya PDF screenshots ke '
    'form mein WhatsApp par share hote hain. Humne is problem ko solve kiya:'
))
story.append(bullet('<b>Library:</b> pytesseract (Python wrapper for Tesseract OCR engine)'))
story.append(bullet('<b>Preprocessing pipeline:</b> Image → Grayscale conversion → Otsu\'s binary threshold → Tesseract OCR → Extracted text'))
story.append(bullet('<b>Why preprocessing?</b> Raw colorful flyer images mein Tesseract ki accuracy ~40-50% hoti hai. Grayscale + threshold se yeh ~85-92% tak badh jaati hai.'))
story.append(bullet('<b>API endpoint:</b> POST /ocr — user image upload karta hai, server extracted event title, date, venue return karta hai'))
story.append(bullet('<b>Auto-fill:</b> Extracted data EventForm mein auto-populate ho jaata hai — user ko manually type nahi karna padta'))

story.append(Spacer(1, 0.2*cm))
story.append(sub('5.2 Flask Backend (Manav)'))
story.append(bullet('SQLite database with SQLAlchemy ORM — tables: Events, Users, Reviews, Attendance'))
story.append(bullet('REST API endpoints: GET/POST /events, POST /register, POST /login, POST /ocr, GET /timeline'))
story.append(bullet('JWT-based authentication — tokens stored in localStorage on frontend'))
story.append(bullet('Bayesian rating formula: score = (v/(v+m)) * R + (m/(v+m)) * C — prevents new events with 1 review getting unfairly high/low ratings'))
story.append(bullet('seed.py script — populates database with sample events, users, reviews for demo'))

story.append(Spacer(1, 0.2*cm))
story.append(sub('5.3 API Design (Mayank)'))
story.append(bullet('RESTful architecture with clear resource naming'))
story.append(bullet('.env / .env.example — secret keys, DB path, Tesseract path all configurable'))
story.append(bullet('CORS enabled for frontend dev server (localhost:5173) and production'))
story.append(bullet('Input validation and error handling on all endpoints'))
story.append(bullet('Frontend-backend contract defined using request/response JSON schemas'))

story.append(Spacer(1, 0.2*cm))
story.append(sub('5.4 React Frontend (Milan)'))
story.append(bullet('Pages: Login, Discover, Timeline, Community, Organizer, Settings, EventDetail, Notifications, Inbox, AddEvent, EditEvent'))
story.append(bullet('Components: EventForm (smart form with OCR auto-fill), IssueCard (community bug reports), MapView (venue map embed)'))
story.append(bullet('PWA setup: manifest.webmanifest + sw.js service worker — works offline, installable on phone'))
story.append(bullet('Responsive CSS (styles.css — 28KB) — optimized for mobile screens'))
story.append(bullet('React Router for client-side routing without page reloads'))

story.append(Spacer(1, 0.2*cm))
story.append(sub('5.5 CI/CD & Testing'))
story.append(bullet('GitHub Actions workflow (.github/workflows/ci.yml) — runs on every push'))
story.append(bullet('pytest unit tests in backend/tests/ — tests for API endpoints and DB models'))
story.append(bullet('Docker support: Dockerfile + docker-compose.yml for containerized deployment'))

# ══ USP ═══════════════════════════════════════════════════════════════════════
story += section('6. Eventure\'s USP — Why Us Over Others?')
story.append(body('<b>5 things that ONLY Eventure does:</b>'))
story.append(bullet('<b>OCR Event Import:</b> Paste image → events auto-fill. No other college event tool does this.'))
story.append(bullet('<b>Exam-Week Shield:</b> Academic calendar aware. Flags conflicts before you register.'))
story.append(bullet('<b>Multi-Stage Timeline:</b> Track Registration → Round 1 → Round 2 → Finals as separate milestones.'))
story.append(bullet('<b>Post-Attendance Verified Reviews:</b> Review unlocks only after QR scan confirms presence. Zero fake reviews.'))
story.append(bullet('<b>Bayesian Smart Scoring:</b> "Should I attend?" score using weighted formula — not just star average.'))

# ══ CONCLUSION ════════════════════════════════════════════════════════════════
story += section('7. Conclusion')
story.append(body(
    'Eventure ek purpose-built, college-first event management platform hai jo existing generic tools ke '
    'saare major gaps fill karta hai. OCR se entry, Bayesian trust model, exam-aware scheduling, '
    'aur multi-stage hackathon tracking — yeh sab ek jagah. '
    'Hamari team ne end-to-end ek working prototype build kiya hai — backend (Flask), API (REST+JWT), '
    'aur frontend (React PWA) — with CI/CD and Docker support.'
))
story.append(Spacer(1, 0.4*cm))
story.append(HR())
story.append(Paragraph('Eventure — Built for Students, by Students', styles['Subtitle']))

# ══ BUILD ════════════════════════════════════════════════════════════════════
os.makedirs(os.path.dirname(output_path), exist_ok=True)
doc = SimpleDocTemplate(
    output_path, pagesize=A4,
    rightMargin=1.8*cm, leftMargin=1.8*cm,
    topMargin=1.5*cm, bottomMargin=1.5*cm
)
doc.build(story)
print(f"PDF generated at {output_path}")
