from __future__ import annotations
from pathlib import Path
import sys
import yaml


#general parsing spec file, apparently it autoconverts to a dict
def load_spec(spec_path: str) -> dict:
    return yaml.safe_load(Path(spec_path).read_text())

#top level yaml -> dict
def diff_specs(old_spec: dict, new_spec: dict) -> dict:
    return {
        "nouns": diff_nouns(
            old_spec.get("nouns") or {},
            new_spec.get("nouns") or {},
        ),
        "functions": diff_functions(
            old_spec.get("functions") or [],
            new_spec.get("functions") or [],
        ),
    }

def diff_noun_fields(old_fields: dict, new_fields: dict) -> dict:
    old_names = set(old_fields or {})
    new_names = set(new_fields or {})

    # Checking if the field datatypes have changed for those present in old and new
    retyped = {
        field: {"from": old_fields[field], "to": new_fields[field]}
        for field in old_names & new_names
        if old_fields[field] != new_fields[field]
    }
    return {
        "added":   sorted(new_names - old_names), #only in the new version
        "removed": sorted(old_names - new_names), #only in the old version
        "retyped": retyped,
    }

#similar to old diff_nouns, first compare the dicts then their fields using diff_noun_fields when there are discrepancies
def diff_nouns(old_nouns: dict, new_nouns: dict) -> dict:
    old_nouns = old_nouns or {}
    new_nouns = new_nouns or {}
    old_names = set(old_nouns)
    new_names = set(new_nouns)

    changed = {}
    for noun in old_names & new_names:
        if old_nouns[noun] != new_nouns[noun]:
            changed[noun] = diff_noun_fields(old_nouns[noun], new_nouns[noun])

    return {
        "added":   sorted(new_names - old_names),   # brand-new nouns
        "removed": sorted(old_names - new_names),   # deleted nouns
        "changed": changed,                          #noun field detail
    }

def describe_noun_changes(noun_changes: dict) -> list:
    lines = []
    for name in noun_changes["added"]:
        lines.append(f"  + added noun: {name}")
    for name in noun_changes["removed"]:
        lines.append(f"  - removed noun: {name}")
    for noun, detail in noun_changes["changed"].items():
        parts = []
        for field in detail["added"]:
            parts.append(f"+{field}")
        for field in detail["removed"]:
            parts.append(f"-{field}")
        for field, change in detail["retyped"].items():
            parts.append(f"{field}: {change['from']} -> {change['to']}")
        lines.append(f"  ~ changed noun: {noun}  ({', '.join(parts)})")
    return lines

#ive separated nouns and verbs because they are in slighlty different formats
#also functions is a list because you can take the function key of the yaml dict to produce a list per funct
def diff_functions(old_functions: list, new_functions: list) -> dict:
    old_by_name = {function["name"]: function for function in old_functions}
    new_by_name = {function["name"]: function for function in new_functions}

    old_names = set(old_by_name)
    new_names = set(new_by_name)

    return {
        "added":   sorted(new_names - old_names),
        "removed": sorted(old_names - new_names),
        "changed": sorted(
            name for name in old_names & new_names
            if old_by_name[name] != new_by_name[name]
        ),
    }

def describe_function_changes(function_changes: dict) -> list:
    lines = []
    for name in function_changes["added"]:
        lines.append(f"  + added function: {name}")
    for name in function_changes["removed"]:
        lines.append(f"  - removed function: {name}")
    for name in function_changes["changed"]:
        lines.append(f"  ~ changed function: {name}")
    return lines

#Combine the noun and function change descriptions into one summary
def describe(changeset: dict) -> str:
    lines = describe_noun_changes(changeset["nouns"]) \
          + describe_function_changes(changeset["functions"])
    return "\n".join(lines) if lines else "  (no changes)"


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python specdiff.py <old_spec.yaml> <new_spec.yaml>",
              file=sys.stderr)
        sys.exit(1)
    old_spec = load_spec(sys.argv[1])
    new_spec = load_spec(sys.argv[2])
    changeset = diff_specs(old_spec, new_spec)
    print("Changes between the two specs:\n")
    print(describe(changeset))