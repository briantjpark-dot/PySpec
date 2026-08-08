from spec_models import *
from functions import *

def test_sort_events_1():
    result = sort_events(events=[Event(title='Lunch', start='12:00', end='13:00'), Event(title='Standup', start='09:00', end='09:15'), Event(title='Review', start='15:00', end='16:00')])
    expected = [Event(title='Standup', start='09:00', end='09:15'), Event(title='Lunch', start='12:00', end='13:00'), Event(title='Review', start='15:00', end='16:00')]
    assert result == expected

def test_sort_events_2():
    result = sort_events(events=[Event(title='Only', start='10:00', end='11:00')])
    expected = [Event(title='Only', start='10:00', end='11:00')]
    assert result == expected

def test_has_overlap_1():
    result = has_overlap(events=[Event(title='A', start='09:00', end='10:30'), Event(title='B', start='10:00', end='11:00')])
    expected = True
    assert result == expected

def test_has_overlap_2():
    result = has_overlap(events=[Event(title='A', start='09:00', end='10:00'), Event(title='B', start='10:00', end='11:00')])
    expected = False
    assert result == expected

def test_has_overlap_3():
    result = has_overlap(events=[])
    expected = False
    assert result == expected

def test_has_overlap_4():
    result = has_overlap(events=[Event(title='Big', start='09:00', end='17:00'), Event(title='Small', start='12:00', end='13:00')])
    expected = True
    assert result == expected

def test_free_slots_1():
    result = free_slots(events=[Event(title='Standup', start='09:00', end='09:30'), Event(title='Review', start='14:00', end='15:00')], day_start='08:00', day_end='17:00')
    expected = [Slot(start='08:00', end='09:00'), Slot(start='09:30', end='14:00'), Slot(start='15:00', end='17:00')]
    assert result == expected

def test_free_slots_2():
    result = free_slots(events=[], day_start='08:00', day_end='17:00')
    expected = [Slot(start='08:00', end='17:00')]
    assert result == expected

def test_free_slots_3():
    result = free_slots(events=[Event(title='Early', start='08:00', end='09:00')], day_start='08:00', day_end='10:00')
    expected = [Slot(start='09:00', end='10:00')]
    assert result == expected

def test_fits_in_slot_1():
    result = fits_in_slot(slot=Slot(start='09:00', end='10:30'), minutes=60)
    expected = True
    assert result == expected

def test_fits_in_slot_2():
    result = fits_in_slot(slot=Slot(start='09:00', end='10:00'), minutes=60)
    expected = True
    assert result == expected

def test_fits_in_slot_3():
    result = fits_in_slot(slot=Slot(start='09:00', end='10:00'), minutes=61)
    expected = False
    assert result == expected
