"""In-process fan-out of SSE events: one bounded queue per connected client."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

#: A client that falls this far behind loses its oldest pending events. Every
#: state event carries a full snapshot, so it is consistent again on the next one.
QUEUE_SIZE = 256


@dataclass(frozen=True)
class StreamEvent:
    name: str
    sequence: int
    data: str  # JSON document


class Broadcaster:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[StreamEvent]] = set()

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    def subscribe(self) -> asyncio.Queue[StreamEvent]:
        queue: asyncio.Queue[StreamEvent] = asyncio.Queue(maxsize=QUEUE_SIZE)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[StreamEvent]) -> None:
        self._subscribers.discard(queue)

    def publish(self, event: StreamEvent) -> None:
        for queue in self._subscribers:
            if queue.full():
                queue.get_nowait()
            queue.put_nowait(event)
