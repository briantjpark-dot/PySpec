from __future__ import annotations
from pathlib import Path
import sys

from build import gen_stubs, gen_tests
from specdiff import load_spec, diff_specs, describe

#Retrieving nouns
def nouns_of(spec: dict) -> dict:
    return spec.get("nouns") or {}

#Retrieving the datatype per noun -> a bit confusing, but if there is a variable like "events: list of event" it returns "list of event" 
# which later gets stripped to "event" to be parsed for noun search
#A real limit rn is that everything has to be in singular form; plurals with "s" and "es" endings get funky
def noun_of_type(datatype: str, nouns: dict) -> str | None:
    name = str(datatype).strip().lower()
    for prefix in ("list of ", "a ", "an "):
        if name.startswith(prefix):
            name = name[len(prefix):].strip()
    return name if name in nouns else None

#eturn the names of functions whose inputs or outputs refer to any of the changed nouns
def functions_using_nouns(functions: list, changed_noun_names: set, nouns: dict) -> set:
    affected = set()
    for function in functions:
        # each input's datatype is a dict value; the output is its own value
        datatypes = list(function.get("input", {}).values()) + [function.get("output", "")]
        for datatype in datatypes:
            noun = noun_of_type(datatype, nouns)
            if noun in changed_noun_names:
                affected.add(function["name"])
                break
    return affected

def regenerate_changed(old_spec: dict, new_spec: dict) -> dict:
    changeset = diff_specs(old_spec, new_spec)
    fn_changes = changeset["functions"]
    new_functions = new_spec.get("functions") or []
    nouns = nouns_of(new_spec)

    # functions whose own text was added or changed
    names_to_rebuild = set(fn_changes["added"]) | set(fn_changes["changed"])

    # functions affected by a changed or removed noun/"ripple"
    changed_nouns = set(changeset["nouns"]["changed"]) | set(changeset["nouns"]["removed"])
    rippled = functions_using_nouns(new_functions, changed_nouns, nouns)
    names_to_rebuild |= rippled #symbol just means to add all the ripplied stuff into names_to_rebuild

    names_to_rebuild = sorted(names_to_rebuild)
    subset = [f for f in new_functions if f["name"] in names_to_rebuild]

    return {
        "changeset": changeset,
        "names": names_to_rebuild,
        "removed": fn_changes["removed"],
        "stubs": gen_stubs(subset, nouns),
        "tests": gen_tests(subset, nouns),
    }

def write_packet(result: dict, out_dir: str = "changed") -> None:
    out = Path(out_dir)
    out.mkdir(exist_ok=True)

    (out / "functions_changed.py").write_text(result["stubs"])
    (out / "test_changed.py").write_text(result["tests"])

    note = ["# Changed functions to re-implement", ""]
    note.append("These functions were added or changed in the spec. Re-implement")
    note.append("each one so its tests in `test_changed.py` pass. Leave every")
    note.append("other function in the project alone -- they did not change.")
    note.append("")
    note.append("## Affected functions")
    note.append("")
    for name in result["names"]:
        note.append(f"- {name}")
    if result["removed"]:
        note.append("")
        note.append("## Functions removed from the spec")
        note.append("")
        note.append("These no longer exist in the spec. You may delete them "
                    "and their old tests from the main project:")
        note.append("")
        for name in result["removed"]:
            note.append(f"- {name}")
    (out / "CHANGES.md").write_text("\n".join(note))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python regen.py <old_spec.yaml> <new_spec.yaml>",
              file=sys.stderr)
        sys.exit(1)

    old_spec = load_spec(sys.argv[1])
    new_spec = load_spec(sys.argv[2])
    result = regenerate_changed(old_spec, new_spec)

    print("Changes between the two specs:\n")
    print(describe(result["changeset"]))
    print()

    if not result["names"] and not result["removed"]:
        print("No functions to regenerate.")
    else:
        write_packet(result)
        print(f"\nRegenerated {len(result['names'])} function(s) into ./changed/")
        print("Hand that folder to Claude Code to re-implement just those.")