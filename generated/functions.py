from spec_models import *

def total_per_person(expenses: list[Expense]) -> str:
    """Add up how much each person paid, returned as a name to total mapping"""
    raise NotImplementedError

def biggest_spender(expenses: list[Expense]) -> str:
    """Return the name of the person who paid the most in total"""
    raise NotImplementedError

def even_split_owed(total: float, people: int) -> float:
    """Given the total spent and the number of people, return how much each person owes to make everyone pay an equal share.
"""
    raise NotImplementedError
