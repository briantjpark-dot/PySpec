from dataclasses import dataclass

@dataclass
class Event:
    title: str
    start: str
    end: str

@dataclass
class Slot:
    start: str
    end: str
