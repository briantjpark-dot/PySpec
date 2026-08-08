from spec_models import *
from functions import *

def test_count_open_1():
    result = count_open(tasks=[Task(title='Laundry', priority=1, done=False), Task(title='Dishes', priority=2, done=True)])
    expected = 1
    assert result == expected

def test_highest_priority_1():
    result = highest_priority(tasks=[Task(title='Laundry', priority=1, done=False), Task(title='Dishes', priority=5, done=False)])
    expected = 'Dishes'
    assert result == expected
