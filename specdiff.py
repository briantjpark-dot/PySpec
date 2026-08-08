from __future__ import annotations
from pathlib import Path
import sys
import yaml


#general parsing spec file, apparently it autoconverts to a dict
def load_spec(spec_path: str) -> dict:
    return yaml.safe_load(Path(spec_path).read_text())


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


def diff_nouns(old_nouns: dict, new_nouns: dict) -> dict:
    old_names = set(old_nouns or {})
    new_names = set(new_nouns or {})

    return {
        "added":   sorted(new_names - old_names),
        "removed": sorted(old_names - new_names),
        "changed": sorted(
            name for name in old_names & new_names
            if old_nouns[name] != new_nouns[name]
        ),
    }


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


def describe(changeset: dict) -> str:
    lines = []
    for section_name in ("nouns", "functions"):
        section = changeset[section_name]
        singular = section_name[:-1] # "nouns" -> "noun"
        for name in section["added"]:
            lines.append(f"  + added {singular}: {name}")
        for name in section["removed"]:
            lines.append(f"  - removed {singular}: {name}")
        for name in section["changed"]:
            lines.append(f"  ~ changed {singular}: {name}")
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