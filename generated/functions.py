from spec_models import *

def sort_events(events: list[Event]) -> list[Event]:
    """Sort a day's events by their start time, earliest first"""
    raise NotImplementedError

def has_overlap(events: list[Event]) -> bool:
    """Return yes if any two events in the list overlap in time. Events that only touch at the edges (one ends exactly when the next starts) do NOT count as overlapping.
"""
    raise NotImplementedError

def free_slots(events: list[Event], day_start: str, day_end: str) -> list[Slot]:
    """Given a day's events and the day's start and end times, return the free gaps: before the first event, between events, and after the last event. Assume the events do not overlap and are not necessarily sorted.
"""
    raise NotImplementedError

def fits_in_slot(slot: Slot, minutes: int) -> bool:
    """Given a free slot and a meeting length in minutes, return yes if a meeting of that length fits inside the slot.
"""
    raise NotImplementedError
