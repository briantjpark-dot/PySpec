from spec_models import *
from functions import *

def test_total_per_person_1():
    result = total_per_person(expenses=[Expense(who='Ana', amount=30.0, label='lunch'), Expense(who='Ben', amount=10.0, label='coffee'), Expense(who='Ana', amount=20.0, label='taxi')])
    expected = 'Ana: 50.0, Ben: 10.0'
    assert result == expected

def test_biggest_spender_1():
    result = biggest_spender(expenses=[Expense(who='Ana', amount=30.0, label='lunch'), Expense(who='Ben', amount=10.0, label='coffee'), Expense(who='Ana', amount=20.0, label='taxi')])
    expected = 'Ana'
    assert result == expected

def test_even_split_owed_1():
    result = even_split_owed(total=60.0, people=3)
    expected = 20.0
    assert result == expected

def test_even_split_owed_2():
    result = even_split_owed(total=100.0, people=4)
    expected = 25.0
    assert result == expected
