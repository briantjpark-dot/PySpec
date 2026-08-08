from __future__ import annotations
from pathlib import Path
import sys

from build import gen_stubs, gen_tests
from specdiff import load_spec, diff_specs, describe

#retrieving nouns
def nouns_of(spec: dict) -> dict:
    return spec.get("nouns") or {}


def regenerate_changed(old_spec: dict, new_spec: dict) -> dict:
    changeset = diff_specs(old_spec, new_spec)
    fn_changes = changeset["functions"]

    # added + changed need new skeleton, removed need nothing generated.
    names_to_rebuild = sorted(set(fn_changes["added"]) | set(fn_changes["changed"]))

    new_functions = new_spec.get("functions") or []
    subset = [f for f in new_functions if f["name"] in names_to_rebuild]

    nouns = nouns_of(new_spec)

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