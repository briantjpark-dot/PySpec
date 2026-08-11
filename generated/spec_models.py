from dataclasses import dataclass

@dataclass
class Expense:
    who: str
    amount: float
    label: str
