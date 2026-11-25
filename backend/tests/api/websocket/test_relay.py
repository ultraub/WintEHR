"""Live updates must reach every browser, whichever uvicorn worker it is on.

Regression for the prod-profile gap where each worker kept its own table of
WebSocket connections: a write handled by one worker only reached browsers
connected to that same worker (~1 in 4 with `--workers 4`). A FakeRedis
pub/sub hub stands in for Redis; two ConnectionManagers sharing it, each with
its own connection pool, model two workers.
"""

from __future__ import annotations

import asyncio
import json

import pytest

from api.websocket import fhir_notifications
from api.websocket.connection_manager import ConnectionManager, Subscription
from api.websocket.connection_pool import ConnectionPool
from api.websocket.fhir_notifications import FHIRNotificationService, patient_id_of
from api.websocket.relay import BroadcastRelay


class FakePubSub:
    def __init__(self, hub):
        self.hub = hub
        self.queue: asyncio.Queue = asyncio.Queue()

    async def subscribe(self, channel):
        if self.hub.fail_subscribes > 0:
            self.hub.fail_subscribes -= 1
            raise ConnectionError("redis went away")
        self.hub.subscribers.setdefault(channel, []).append(self.queue)

    async def get_message(self, ignore_subscribe_messages=True, timeout=None):
        try:
            data = await asyncio.wait_for(self.queue.get(), timeout=0.05)
        except asyncio.TimeoutError:
            return None
        return {"type": "message", "data": data}

    async def aclose(self):
        for queues in self.hub.subscribers.values():
            if self.queue in queues:
                queues.remove(self.queue)


class FakeRedis:
    """The subset of redis.asyncio pub/sub the relay uses."""

    def __init__(self):
        self.subscribers: dict[str, list[asyncio.Queue]] = {}
        self.published: list[str] = []
        self.fail_subscribes = 0

    def pubsub(self):
        return FakePubSub(self)

    async def publish(self, channel, payload):
        self.published.append(payload)
        for queue in self.subscribers.get(channel, []):
            queue.put_nowait(payload.encode())
        return len(self.subscribers.get(channel, []))


class FakeSocket:
    def __init__(self):
        self.sent: list[dict] = []

    async def send_text(self, text):
        self.sent.append(json.loads(text))

    def updates(self):
        return [m for m in self.sent if m.get("type") == "update"]


async def make_worker(redis=None) -> ConnectionManager:
    manager = ConnectionManager()
    manager.pool = ConnectionPool()
    manager.relay = BroadcastRelay(redis_url="", redis_client=redis, retry_seconds=0.01)
    if redis is not None:
        assert await manager.start_relay() is True
        assert await manager.relay.wait_until_listening(1.0)
    return manager


async def connect(manager: ConnectionManager, client_id: str, **subscription) -> FakeSocket:
    socket = FakeSocket()
    await manager.connect(client_id, socket)
    await manager.subscribe(client_id, f"sub-{client_id}", **subscription)
    return socket


async def settle():
    """Let the relay listeners drain the fake hub."""
    for _ in range(10):
        await asyncio.sleep(0.02)


@pytest.fixture
async def two_workers():
    redis = FakeRedis()
    a = await make_worker(redis)
    b = await make_worker(redis)
    yield a, b, redis
    await a.stop_relay()
    await b.stop_relay()


CONDITION = {"resourceType": "Condition", "id": "c1", "subject": {"reference": "Patient/p1"}}


@pytest.mark.asyncio
async def test_update_reaches_a_client_on_another_worker(two_workers):
    a, b, _ = two_workers
    on_a = await connect(a, "client-a", patient_ids=["p1"], resource_types=["Condition"])
    on_b = await connect(b, "client-b", patient_ids=["p1"], resource_types=["Condition"])

    await a.broadcast_resource_update("Condition", "c1", "created", CONDITION, patient_id="p1")
    await settle()

    assert len(on_b.updates()) == 1, "the other worker's client never heard about the write"
    assert on_b.updates()[0]["data"]["resource"] == CONDITION
    assert on_b.updates()[0]["data"]["patient_id"] == "p1"
    # ...and the writing worker's own client hears it once, not again as an echo
    assert len(on_a.updates()) == 1


@pytest.mark.asyncio
async def test_update_is_sent_once_however_many_subscriptions_match(two_workers):
    a, _, _ = two_workers
    socket = await connect(a, "client-a", patient_ids=["p1"], resource_types=["Condition"])
    await a.subscribe("client-a", "second", patient_ids=["p1"], resource_types=["Condition", "Observation"])

    await a.broadcast_resource_update("Condition", "c1", "updated", CONDITION, patient_id="p1")
    await settle()

    assert len(socket.updates()) == 1


@pytest.mark.asyncio
async def test_another_patients_chart_is_not_told(two_workers):
    a, b, _ = two_workers
    other = await connect(b, "client-b", patient_ids=["p2"], resource_types=["Condition"])

    await a.broadcast_resource_update("Condition", "c1", "created", CONDITION, patient_id="p1")
    await settle()

    assert other.updates() == []


@pytest.mark.asyncio
async def test_delete_names_the_patient_and_the_resource(two_workers, monkeypatch):
    a, b, _ = two_workers
    on_b = await connect(b, "client-b", patient_ids=["p1"])
    monkeypatch.setattr(fhir_notifications, "manager", a)

    await FHIRNotificationService().notify_resource_deleted("Condition", "c1", patient_id="p1")
    await settle()

    assert len(on_b.updates()) == 1
    data = on_b.updates()[0]["data"]
    assert data["action"] == "deleted"
    assert data["patient_id"] == "p1"
    assert data["resource"] == {"resourceType": "Condition", "id": "c1"}


@pytest.mark.asyncio
async def test_client_published_event_reaches_other_workers_but_not_the_sender(two_workers):
    a, b, _ = two_workers
    sender = await connect(a, "client-a", patient_ids=["p1"])
    peer_same_worker = await connect(a, "client-a2", patient_ids=["p1"])
    peer_other_worker = await connect(b, "client-b", patient_ids=["p1"])
    event = {"type": "order.placed", "payload": {"patientId": "p1"}}

    await a.handle_message("client-a", event)
    await settle()

    assert event in peer_same_worker.sent
    assert event in peer_other_worker.sent
    assert event not in sender.sent


@pytest.mark.asyncio
async def test_without_redis_delivery_stays_local_and_nothing_breaks():
    manager = await make_worker(redis=None)
    assert await manager.start_relay() is False
    assert manager.relay.shared is False
    socket = await connect(manager, "client-a", patient_ids=["p1"])

    await manager.broadcast_resource_update("Condition", "c1", "created", CONDITION, patient_id="p1")

    assert len(socket.updates()) == 1


@pytest.mark.asyncio
async def test_listener_recovers_after_redis_drops():
    redis = FakeRedis()
    redis.fail_subscribes = 2  # the first two subscribe attempts fail
    a = await make_worker(redis=None)
    a.relay = BroadcastRelay(redis_url="", redis_client=redis, retry_seconds=0.01)
    b = await make_worker(redis)
    try:
        assert await a.start_relay() is True
        assert await a.relay.wait_until_listening(1.0), "listener never resubscribed"
        on_a = await connect(a, "client-a", patient_ids=["p1"])

        await b.broadcast_resource_update("Condition", "c1", "created", CONDITION, patient_id="p1")
        await settle()

        assert len(on_a.updates()) == 1
    finally:
        await a.stop_relay()
        await b.stop_relay()


@pytest.mark.asyncio
async def test_a_malformed_relay_message_does_not_stop_the_listener(two_workers):
    a, b, redis = two_workers
    on_b = await connect(b, "client-b", patient_ids=["p1"])

    await redis.publish(a.relay.channel, "not json")
    await a.broadcast_resource_update("Condition", "c1", "created", CONDITION, patient_id="p1")
    await settle()

    assert len(on_b.updates()) == 1


@pytest.mark.asyncio
async def test_disconnect_drops_the_clients_subscriptions():
    manager = await make_worker(redis=None)
    await connect(manager, "client-a", patient_ids=["p1"])

    manager.disconnect("client-a")
    await asyncio.sleep(0)

    assert "client-a" not in manager.subscriptions


@pytest.mark.asyncio
async def test_heartbeats_are_never_rate_limited():
    pool = ConnectionPool()
    socket = FakeSocket()
    await pool.add_connection("client-a", socket)
    pool.rate_limiter.max_messages_per_minute = 2
    for _ in range(2):
        assert await pool.send_to_client("client-a", {"type": "update"})
    assert await pool.send_to_client("client-a", {"type": "update"}) is False

    assert await pool.send_to_client("client-a", {"type": "ping"}) is True


@pytest.mark.parametrize(
    "subscription, resource_type, patient_id, expected",
    [
        ({"patient_ids": ["p1"], "resource_types": ["Condition"]}, "Condition", "p1", True),
        # the chart hears everything about its patient, not just listed types
        ({"patient_ids": ["p1"], "resource_types": ["Condition"]}, "MedicationAdministration", "p1", True),
        ({"patient_ids": ["p1"], "resource_types": ["Condition"]}, "Condition", "p2", False),
        ({"patient_ids": ["p1"]}, "Condition", None, False),
        ({"resource_types": ["Condition"]}, "Condition", "p9", True),
        ({"resource_types": ["Condition"]}, "Observation", "p9", False),
        ({"room": "pharmacy:queue"}, "MedicationDispense", "p9", True),
    ],
)
def test_subscription_matching(subscription, resource_type, patient_id, expected):
    sub = Subscription(id="s", client_id="c", **subscription)
    assert sub.matches(resource_type, patient_id) is expected


@pytest.mark.parametrize(
    "resource, expected",
    [
        ({"resourceType": "Patient", "id": "p1"}, "p1"),
        ({"resourceType": "Condition", "subject": {"reference": "Patient/p1"}}, "p1"),
        ({"resourceType": "AllergyIntolerance", "patient": {"reference": "Patient/p1"}}, "p1"),
        ({"resourceType": "Condition", "subject": {"reference": "Patient/p1/_history/2"}}, "p1"),
        ({"resourceType": "Condition", "subject": {"reference": "Group/g1"}}, None),
        ({"resourceType": "Practitioner", "id": "x"}, None),
        (None, None),
    ],
)
def test_patient_id_of(resource, expected):
    assert patient_id_of(resource) == expected


@pytest.mark.asyncio
async def test_schedule_write_skips_audit_noise_and_missing_ids(monkeypatch):
    calls = []

    class Recorder:
        async def broadcast_resource_update(self, **kwargs):
            calls.append(kwargs)

    monkeypatch.setattr(fhir_notifications, "manager", Recorder())
    service = FHIRNotificationService()

    assert service.schedule_write("created", "AuditEvent", "a1", {}) is False
    assert service.schedule_write("created", "Condition", None, {}) is False
    assert service.schedule_write("created", "Condition", "c1", CONDITION) is True
    await asyncio.sleep(0)
    await asyncio.sleep(0)

    assert [c["resource_type"] for c in calls] == ["Condition"]
    assert calls[0]["patient_id"] == "p1"


def test_schedule_write_outside_an_event_loop_is_a_quiet_no_op():
    assert FHIRNotificationService().schedule_write("created", "Condition", "c1", CONDITION) is False
