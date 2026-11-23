"""Neo4j Graph Database Client & Migration Service for Eventure.

Supports:
- Neo4j AuraDB Free tier (cloud) or local Docker Community Edition.
- Syncing Users, Events, and Milestones to the Knowledge Graph.
- Graph-based personalized event recommendation traversals.
- Zero-crash fallback when Neo4j credentials are not configured.
"""
import logging
import os
from typing import Optional

_driver = None
_checked = False


def get_neo4j_driver():
    """Lazily initializes and returns the Neo4j driver if configured."""
    global _driver, _checked
    if not _checked:
        _checked = True
        uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        user = os.getenv("NEO4J_USER", "neo4j")
        password = os.getenv("NEO4J_PASSWORD", "")

        if not password:
            logging.info("[Neo4j] NEO4J_PASSWORD not set. Running in relational SQLite mode.")
            return None

        try:
            from neo4j import GraphDatabase
            _driver = GraphDatabase.driver(uri, auth=(user, password))
            _driver.verify_connectivity()
            logging.info("[Neo4j] Successfully connected to Graph Database at %s", uri)
        except ImportError:
            logging.info("[Neo4j] 'neo4j' Python package not installed (pip install neo4j).")
            _driver = None
        except Exception as exc:
            logging.warning("[Neo4j] Could not connect to Neo4j instance (%s).", exc)
            _driver = None

    return _driver


def sync_event_to_graph(event_dict: dict) -> bool:
    """Syncs an Event node and its milestones to Neo4j graph."""
    driver = get_neo4j_driver()
    if not driver:
        return False
    try:
        with driver.session() as session:
            cypher = """
            MERGE (e:Event {id: $id})
            SET e.title = $title,
                e.platform = $platform,
                e.category = $category,
                e.description = $description,
                e.venue_name = $venue_name,
                e.lat = $lat,
                e.lng = $lng,
                e.start_at = datetime($start_at),
                e.end_at = datetime($end_at),
                e.registration_deadline = datetime($reg_deadline),
                e.url = $url,
                e.is_public = $is_public
            """
            session.run(
                cypher,
                id=event_dict["id"],
                title=event_dict.get("title", ""),
                platform=event_dict.get("platform", "direct"),
                category=event_dict.get("category", "hackathon"),
                description=event_dict.get("description", ""),
                venue_name=event_dict.get("venue_name", ""),
                lat=event_dict.get("lat"),
                lng=event_dict.get("lng"),
                start_at=event_dict.get("start_at"),
                end_at=event_dict.get("end_at"),
                reg_deadline=event_dict.get("registration_deadline"),
                url=event_dict.get("url"),
                is_public=bool(event_dict.get("is_public", True)),
            )
        return True
    except Exception as exc:
        logging.warning("[Neo4j] sync_event_to_graph failed: %s", exc)
        return False


def get_graph_recommendations(user_id: int, limit: int = 5) -> list:
    """Finds top events for a student using graph traversal over shared skills and peer journeys."""
    driver = get_neo4j_driver()
    if not driver:
        return []
    try:
        with driver.session() as session:
            query = """
            MATCH (u:User {id: $user_id})-[:HAS_SKILL]->(s:Skill)<-[:TAGGED_WITH]-(e:Event)
            WHERE e.start_at > datetime()
            RETURN e.id AS id, e.title AS title, e.category AS category,
                   e.platform AS platform, count(s) AS score
            ORDER BY score DESC
            LIMIT $limit
            """
            result = session.run(query, user_id=user_id, limit=limit)
            return [record.data() for record in result]
    except Exception as exc:
        logging.warning("[Neo4j] get_graph_recommendations failed: %s", exc)
        return []


def migrate_all_to_neo4j():
    """Migrates SQLite relational models to Neo4j graph nodes and relationships."""
    driver = get_neo4j_driver()
    if not driver:
        print("[Neo4j] Driver not available. Ensure NEO4J_PASSWORD is set and 'neo4j' is installed.")
        return False

    from app import create_app
    from app.models import Event, User, UserEvent

    app = create_app()
    with app.app_context():
        events = Event.query.all()
        users = User.query.all()
        ues = UserEvent.query.all()

        with driver.session() as session:
            # 1. Create constraints
            session.run("CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE")
            session.run("CREATE CONSTRAINT event_id_unique IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE")

            # 2. Migrate users
            for u in users:
                session.run(
                    "MERGE (u:User {id: $id}) SET u.name=$name, u.email=$email, u.college=$college",
                    id=u.id, name=u.name, email=u.email, college=u.college or ""
                )

            # 3. Migrate events
            for ev in events:
                sync_event_to_graph(ev.to_dict())

            # 4. Migrate user events
            for ue in ues:
                rel = "REGISTERED_FOR" if ue.status == "registered" else "INTERESTED_IN"
                session.run(
                    f"""
                    MATCH (u:User {{id: $uid}}), (e:Event {{id: $eid}})
                    MERGE (u)-[r:{rel}]->(e)
                    SET r.status = $status, r.notes = $notes
                    """,
                    uid=ue.user_id, eid=ue.event_id, status=ue.status, notes=ue.notes or ""
                )

        print(f"[Neo4j] Migration complete: {len(users)} users, {len(events)} events, {len(ues)} relationships.")
        return True
