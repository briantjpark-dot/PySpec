from __future__ import annotations
from pathlib import Path
import sys
import yaml

NICKNAMES = {
    "text": "str",
    "whole number": "int",
    "number": "float",
    "decimal": "float",
    "yes/no": "bool",
    "true/false": "bool",
    "date": "str",
}


def class_name(noun: str) -> str:
    return "".join(p.capitalize() for p in noun.replace("-", "_").split("_"))

# this function is not only for the nouns section but for the entire yaml file
# remember that raw is the "raw" data within each "noun"


def semantic_types(raw: str, nouns: dict) -> str:
    raw = str(raw).strip()
    low = raw.lower()

    if low.startswith("list of "):
        inner = raw[len("list of "):].strip()
        return f"list[{semantic_types(inner, nouns)}]"

    if low in NICKNAMES:
        return NICKNAMES[low]

    if low in nouns:
        return class_name(low)
    if low.endswith("s") and low[:-1] in nouns:
        return class_name(low[:-1])

    raise SpecError(
        f"I don't recognise the type '{raw}'.\n"
    )

# resolved is the desired datatype
# this just turns the class Something to the string "Something" -> needed for build_object function


def class_to_noun(resolved: str, nouns: dict) -> str | None:
    for key in nouns:
        if class_name(key) == resolved:
            return key
    return None

# yaml dict to actual objects to be used for individual function testing


def build_object(resolved: str, raw, nouns: dict):
    if resolved.startswith("list["):
        inner = resolved[5:-1]
        return "[" + ", ".join(build_object(inner, v, nouns) for v in raw) + "]"
    noun_key = class_to_noun(resolved, nouns)
    if noun_key:
        if not isinstance(raw, dict):
            raise SpecError(f"Expected fields for a {noun_key}, got {raw!r}")
        parts = []
        for fname, ftype_raw in nouns[noun_key].items():
            if fname not in raw:
                raise SpecError(
                    f"Your example is missing '{fname}' for a {noun_key}."
                )
            fresolved = semantic_types(ftype_raw, nouns)
            parts.append(
                f"{fname}={build_object(fresolved, raw[fname], nouns)}")
        return f"{resolved}({', '.join(parts)})"
    return repr(raw)

# turns nouns into a dataclass


def gen_models(nouns: dict) -> str:
    if not nouns:
        return "# No nouns defined.\n"
    out = ["from dataclasses import dataclass", ""]
    for name, fields in nouns.items():
        out.append("@dataclass")
        out.append(f"class {class_name(name)}:")
        if not fields:
            out.append("    pass")
        for fname, ftype in fields.items():
            out.append(f"    {fname}: {semantic_types(ftype, nouns)}")
        out.append("")
    return "\n".join(out)


def gen_stubs(functions: list, nouns: dict) -> str:
    out = ["from spec_models import *", ""]
    for fn in functions:
        args = ", ".join(
            f"{n}: {semantic_types(t, nouns)}" for n, t in fn["input"].items()
        )
        ret = semantic_types(fn["output"], nouns)
        out.append(f"def {fn['name']}({args}) -> {ret}:")
        out.append(f'    """{fn["does"]}"""')
        out.append("    raise NotImplementedError")
        out.append("")
    return "\n".join(out)

# for gentest to work make sure the Claude.md file also pip installs pytest


def gen_tests(functions: list, nouns: dict) -> str:
    out = ["from spec_models import *", "from functions import *", ""]
    for fn in functions:
        for i, ex in enumerate(fn.get("examples", []), start=1):
            given = ex["given"]
            call_args = ", ".join(
                f"{n}={build_object(semantic_types(fn['input'][n], nouns), v, nouns)}"
                for n, v in given.items()
            )
            expected = build_object(
                semantic_types(fn["output"], nouns), ex["returns"], nouns
            )
            out.append(f"def test_{fn['name']}_{i}():")
            out.append(f"    result = {fn['name']}({call_args})")
            out.append(f"    expected = {expected}")
            out.append("    assert result == expected")
            out.append("")
    if len(out) == 3:
        out.append("# No examples found, so no tests were generated.")
    return "\n".join(out)

# I've cut generating the main pipeline for now


def gen_claude_md(spec: dict, functions: list, main_steps: list) -> str:
    ctx_blocks = spec.get("context_blocks", {})
    overview = spec.get("overview", "").strip()

    out = [f"# {spec.get('project', 'Project')}", ""]
    out.append("## Your job")
    out.append("")
    out.append("Every function in `functions.py` currently ends in "
               "`raise NotImplementedError`. Replace each of those with a real "
               "implementation so that **all tests in `test_functions.py` pass**. "
               "Install pytest if needed (`pip install pytest`) and run the tests "
               "with `pytest` from this folder. Do not change the function names, "
               "their arguments, their return types, or the dataclasses in "
               "`spec_models.py` -- those are the contract. Only fill in bodies.")
    out.append("")
    out.append("## Project overview")
    out.append("")
    out.append(overview or "_(none provided)_")
    out.append("")
    out.append("## Functions to implement")
    out.append("")
    for fn in functions:
        out.append(f"### `{fn['name']}`")
        out.append("")
        out.append(fn["does"])
        out.append("")
        ctx_key = fn.get("context")
        if ctx_key and ctx_key != "overview":
            chunk = ctx_blocks.get(ctx_key)
            if chunk:
                out.append("**Relevant context:**")
                out.append("")
                out.append(chunk.strip())
                out.append("")

    if main_steps:
        out.append("## Intended pipeline")
        out.append("")
        out.append("Once the functions pass their tests, write a `main()` in "
                   "`pipeline.py` that runs them in this order, feeding each "
                   "function's output into the next:")
        out.append("")
        out.append("  " + " -> ".join(main_steps))
        out.append("")
        out.append("Only the final result needs to be returned.")
        out.append("")
    return "\n".join(out)


class SpecError(Exception):
    pass


# final build of all the necessary python files
def build(spec_path: str, out_dir: str = "generated") -> None:
    spec = yaml.safe_load(Path(spec_path).read_text())
    nouns = spec.get("nouns") or {}
    functions = spec.get("functions") or []
    main_steps = spec.get("main") or []

    # light validation with friendly messages
    names = [f["name"] for f in functions]
    for step in main_steps:
        if step not in names:
            raise SpecError(
                f"Your 'main' pipeline mentions '{step}', but there's no "
                f"function with that name. Defined functions: "
                f"{', '.join(names) or 'none'}."
            )

    out = Path(out_dir)
    out.mkdir(exist_ok=True)

    (out / "spec_models.py").write_text(gen_models(nouns))
    (out / "functions.py").write_text(gen_stubs(functions, nouns))
    (out / "test_functions.py").write_text(gen_tests(functions, nouns))
    (out / "CLAUDE.md").write_text(gen_claude_md(spec, functions, main_steps))

    print(f"Wrote skeleton to ./{out_dir}/")
    for p in sorted(out.iterdir()):
        print(f"  {p.name}")
    print("\nNext: hand this folder to Claude Code and ask it to make the "
          "tests pass.")


if __name__ == "__main__":
    spec_file = sys.argv[1] if len(sys.argv) > 1 else "spec.yaml"
    try:
        build(spec_file)
    except SpecError as e:
        print(
            f"\n  There is a problem with your spec file:\n\n    {e}\n", file=sys.stderr)
        sys.exit(1)
