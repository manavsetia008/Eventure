# Neo4j Graph Database Architecture for Eventure

This document provides the complete Neo4j Graph Database architecture for Eventure, replacing relational table joins with high-performance graph traversals for personalized event discovery, schedule clash detection, peer matching, and skill alignment.

---

## 1. Where to Find Free Neo4j Instances

You have two primary free options to deploy and run Neo4j without any cost:

### Option A: Neo4j AuraDB Free (Cloud-Hosted — Recommended)
- **URL**: [https://neo4j.com/cloud/aura-free/](https://neo4j.com/cloud/aura-free/)
- **Cost**: **$0 / Forever** (No credit card required)
- **Limits**: Up to **200,000 nodes** and **400,000 relationships** (more than enough for 10,000+ campus events and students).
- **Features**: Includes the interactive visual **Neo4j Workspace** web UI to view and explore graph connections in 3D/2D.
- **How to set up**:
  1. Visit [https://neo4j.com/cloud/aura-free/](https://neo4j.com/cloud/aura-free/) and click **Start Free**.
  2. Sign in with your Google or GitHub account.
  3. Click **New Instance** -> Select **AuraDB Free**.
  4. Download your generated credentials file containing your connection URI (`neo4j+s://...`) and password.
  5. Copy the URI and password into your `backend/.env`:
     ```env
     NEO4J_URI=neo4j+s://<your-instance-id>.databases.neo4j.io
     NEO4J_USER=neo4j
     NEO4J_PASSWORD=<your-generated-password>
     ```

### Option B: Neo4j Community Edition (Local Docker Container)
- **Cost**: Free & Open Source (GPLv3)
- **Run with Docker** (1-line command):
  ```bash
  docker run -d \
    --name eventure-neo4j \
    -p 7474:7474 -p 7687:7687 \
    -v neo4j_data:/data \
    -e NEO4J_AUTH=neo4j/eventure_secret \
    neo4j:community
  ```
- **Access UI**: Open `http://localhost:7474` in your browser.
- **Set in `.env`**:
  ```env
  NEO4J_URI=bolt://localhost:7687
  NEO4J_USER=neo4j
  NEO4J_PASSWORD=eventure_secret
  ```

---

## 2. Graph Schema Architecture

### Node Labels & Properties

#### `(:User)`
- `id`: Integer (Unique)
- `name`: String
- `email`: String (Unique)
- `role`: String ("student" | "organizer" | "admin")
- `primary_language`: String ("en", "hi-IN", "ta-IN", etc.)
- `scoring_mode`: String ("balanced", "interest_first", "deadline_first", "nearby_first")
- `threshold_keep`: Integer
- `created_at`: DateTime

#### `(:Event)`
- `id`: Integer (Unique)
- `title`: String
- `platform`: String ("Unstop", "Devfolio", "Hack2skill", "Luma", "direct")
- `category`: String ("hackathon", "workshop", "contest", "fest", "conference")
- `venue_name`: String
- `lat`: Float
- `lng`: Float
- `start_at`: DateTime
- `end_at`: DateTime
- `registration_deadline`: DateTime
- `url`: String
- `is_public`: Boolean

#### `(:Stage)`
- `id`: Integer
- `name`: String (e.g., "Abstract PPT", "Prototype Review", "Grand Finale")
- `due_at`: DateTime
- `done`: Boolean

#### `(:Club)`
- `id`: Integer
- `name`: String
- `description`: String

#### `(:College)`
- `name`: String (Unique)
- `lat`: Float
- `lng`: Float

#### `(:Skill)` / `(:Topic)`
- `name`: String (Unique, e.g. "AI", "Web3", "Robotics", "Design")

---

### Relationship Model

```
(User)-[:STUDIES_AT]->(College)
(User)-[:HAS_SKILL {proficiency: "beginner"|"intermediate"|"expert"}]->(Skill)
(User)-[:FOLLOWS]->(Club)
(User)-[:REGISTERED_FOR {status: "registered", custom_score: 85, created_at: ...}]->(Event)
(User)-[:INTERESTED_IN {custom_score: 65}]->(Event)
(User)-[:ATTENDED {rating: 4.8}]->(Event)
(User)-[:TOP_PRIORITY {call_scheduled_at: ..., phone: ...}]->(Event)

(Club)-[:ORGANIZES]->(Event)
(Event)-[:HOSTED_AT]->(College)
(Event)-[:TAGGED_WITH]->(Skill)
(Event)-[:HAS_MILESTONE]->(Stage)
(Event)-[:POTENTIAL_CLASH {travel_minutes: 45, time_gap_hours: 0.5}]->(Event)
(College)-[:DISTANCE_TO {km: 14.2, road_minutes: 35}]->(College)
```

---

## 3. Recommended Cypher Queries for Production

### A. Graph Traversal: Real-time Personalized Hackathons for Student
Finds hackathons matching the student's skills, friends' registrations, and preferred travel distance:
```cypher
MATCH (u:User {email: $email})-[:HAS_SKILL]->(s:Skill)<-[:TAGGED_WITH]-(e:Event {category: "hackathon"})
WHERE e.start_at > datetime()
OPTIONAL MATCH (u)-[:STUDIES_AT]->(c1:College)-[d:DISTANCE_TO]->(c2:College)<-[:HOSTED_AT]-(e)
RETURN e.id AS event_id,
       e.title AS title,
       e.platform AS platform,
       e.start_at AS start_at,
       count(DISTINCT s) AS matched_skills,
       coalesce(d.km, 0) AS distance_km
ORDER BY matched_skills DESC, e.start_at ASC
LIMIT 10;
```

### B. Graph Clash Detection: Real-Time Timeline Collisions
Detects if any two events registered by the student overlap in time or lack sufficient travel commute buffer:
```cypher
MATCH (u:User {id: $userId})-[r1:REGISTERED_FOR]->(e1:Event)
MATCH (u)-[r2:REGISTERED_FOR]->(e2:Event)
WHERE id(e1) < id(e2)
  AND e1.start_at < e2.end_at 
  AND e2.start_at < e1.end_at
RETURN e1.title AS event_a,
       e2.title AS event_b,
       e1.start_at AS a_start,
       e2.start_at AS b_start,
       "direct_overlap" AS clash_type;
```

### C. Top-Priority Milestone Query for Sarvam Call Dispatcher
Finds the single top-priority event for a user and calculates the latest stage deadline:
```cypher
MATCH (u:User {id: $userId})-[tp:TOP_PRIORITY]->(e:Event)-[:HAS_MILESTONE]->(s:Stage)
WHERE s.done = false
WITH e, max(s.due_at) AS latest_deadline, tp.phone AS phone
RETURN e.title AS title,
       latest_deadline,
       latest_deadline - duration({hours: 24}) AS call_trigger_time,
       phone;
```

---

## 4. Migration Script: SQLite to Neo4j

To migrate existing relational data to Neo4j, run the Python sync script included in `app/services/neo4j_client.py`:
```bash
python -c "from app.services.neo4j_client import migrate_all_to_neo4j; migrate_all_to_neo4j()"
```
This iterates through Users, Events, and UserEvents and creates native nodes and edges with indexes.
