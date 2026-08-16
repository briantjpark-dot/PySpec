from __future__ import annotations
from datetime import date, datetime
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

    if low.startswith("a "):
        return semantic_types(raw[2:].strip(), nouns)
    if low.startswith("an "):
        return semantic_types(raw[3:].strip(), nouns)

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


def to_python_literal(value) -> str:
    if isinstance(value, (date, datetime)):
        return repr(value.isoformat())
    if isinstance(value, list):
        return "[" + ", ".join(to_python_literal(v) for v in value) + "]"
    if isinstance(value, dict):
        raise SpecError(f"Can't turn {value!r} into a literal")
    return repr(value)


# Finds the sign a colon got left out of a "name: type"
# - a multi-word string mapped to None (a lone malformed
#   entry with a valid sibling before it collapses this way)
# - the whole block collapsed into one multi-word plain string where YAML just reads it as
#   one scalar value instead of raising).
def _missing_colon_in(fields) -> str | None:
    if isinstance(fields, dict):
        for k, v in fields.items():
            if isinstance(k, str) and v is None and len(k.split()) > 1:
                return k
        return None
    if isinstance(fields, str) and len(fields.split()) > 1:
        return fields
    return None


def _raise_missing_colon(bad_key: str, context: str) -> None:
    first, _, rest = bad_key.partition(" ")
    rest = rest.strip()
    suggestion = f"{first}: {rest}" if rest else f"{first}: ..."
    raise SpecError(
        f"It looks like a colon is missing in {context}, near `{bad_key}`.\n"
        f"YAML parsed `{bad_key}` as a single field name with no type, "
        f"which usually means a colon got left out.\n"
        f"Did you mean `{suggestion}`?"
    )


# Checks noun field declarations and function input: blocks -- both are
# always written block-style in this app's convention, so a missing colon
# there always shows up either as a multi-word key mapped to None, or (when
# there's nothing else in the block to signal it's a mapping) the whole
# thing collapsing into one multi-word scalar string.
def check_for_missing_colons(spec: dict) -> None:
    nouns = spec.get("nouns") or {}
    for noun_name, fields in nouns.items():
        bad_key = _missing_colon_in(fields)
        if bad_key:
            _raise_missing_colon(bad_key, f"noun '{noun_name}'")

    for fn in spec.get("functions") or []:
        if not isinstance(fn, dict):
            continue
        bad_key = _missing_colon_in(fn.get("input"))
        if bad_key:
            _raise_missing_colon(bad_key, f"function '{fn.get('name', '?')}'s input")


# Checks a given: example's noun-instance values -- e.g. profile_1: {name
# Sam, age: 30} parses to a dict with fewer keys than the noun declares,
# one of them the merged 'name Sam'. Runs after the given/input name-match
# guard in gen_tests, which already confirmed the top-level param names line up.
def _check_given_instance_shapes(fn: dict, given: dict, nouns: dict, example_index: int) -> None:
    for param_name, type_raw in fn["input"].items():
        resolved = semantic_types(type_raw, nouns)
        noun_key = class_to_noun(resolved, nouns)
        if not noun_key:
            continue
        value = given[param_name]
        if not isinstance(value, dict):
            continue
        expected_fields = set(nouns[noun_key])
        if set(value) == expected_fields:
            continue
        merged_key = next(
            (k for k in value
             if isinstance(k, str) and value[k] is None and len(k.split()) > 1),
            None,
        )
        if merged_key is None:
            continue
        first, _, rest = merged_key.partition(" ")
        raise SpecError(
            f"In '{fn['name']}', example #{example_index}'s '{param_name}' "
            f"looks like it's missing a colon near `{merged_key}`.\n"
            f"Did you mean `{first}: {rest.strip()}`?"
        )


def build_object(resolved: str, raw, nouns: dict):
    if resolved.startswith("list["):
        if not isinstance(raw, list):
            raise SpecError(f"Expected a list of {resolved[5:-1]}, got {raw!r}")
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
    return to_python_literal(raw)

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
            if "given" not in ex or "returns" not in ex:
                continue
            given = ex["given"]
#new guard for mismatch between # of input variables and given variables in examples
            input_names = set(fn["input"])
            given_names = set(given) if isinstance(given, dict) else None
            if given_names != input_names:
                if given_names is None:
                    raise SpecError(
                        f"In '{fn['name']}', example #{i}'s 'given' should map "
                        f"each input name to its value, got {given!r}."
                    )
                detail = []
                missing = sorted(input_names - given_names)
                extra = sorted(given_names - input_names)
                if missing:
                    detail.append(f"missing {', '.join(missing)}")
                if extra:
                    detail.append(f"has unknown field(s) {', '.join(extra)}")
                raise SpecError(
                    f"In '{fn['name']}', example #{i}'s 'given' doesn't match "
                    f"its inputs: {'; '.join(detail)}."
                )
            _check_given_instance_shapes(fn, given, nouns, i)
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
    overview = spec["overview"].strip()

    out = [f"# {spec['project']}", ""]
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
    out.append(overview)
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


REQUIRED_FUNCTION_FIELDS = ("does", "input", "output")


# name/does/input/output define the contract (signature + docstring) so they're
# required; examples (and given/returns within each one) only feed generated
# tests, so a function without them just gets no tests.
def validate_functions(functions: list) -> None:
    for i, fn in enumerate(functions, start=1):
        if not isinstance(fn, dict):
            raise SpecError(f"Function #{i} should be a mapping, got {fn!r}.")
        if not fn.get("name"):
            raise SpecError(f"Function #{i} is missing a name.")
        missing = [f for f in REQUIRED_FUNCTION_FIELDS if f not in fn]
        if missing:
            raise SpecError(
                f"Function '{fn['name']}' is missing required field(s): "
                f"{', '.join(missing)}."
            )


def generate(spec: dict) -> dict[str, str]:
    """Pure: a parsed spec in, {filename: file-contents} out. No disk, no print."""
    if not isinstance(spec, dict):
        raise SpecError(
            f"Your spec should be a YAML mapping (project/nouns/functions/...), "
            f"but it parsed as {type(spec).__name__}: {spec!r}"
        )

    if not spec.get("project"):
        raise SpecError("Your spec is missing a 'project' name.")
    if not spec.get("overview"):
        raise SpecError("Your spec is missing an 'overview'.")

    check_for_missing_colons(spec)

    nouns = spec.get("nouns") or {}
    functions = spec.get("functions") or []
    main_steps = spec.get("main") or []

    validate_functions(functions)

    # validation so that the pipeline must name a real function
    names = [f["name"] for f in functions]
    for step in main_steps:
        if step not in names:
            raise SpecError(
                f"Your 'main' pipeline mentions '{step}', but there's no "
                f"function with that name. Defined functions: "
                f"{', '.join(names) or 'none'}."
            )

    return {
        "spec_models.py":    gen_models(nouns),
        "functions.py":      gen_stubs(functions, nouns),
        "test_functions.py": gen_tests(functions, nouns),
        "CLAUDE.md":         gen_claude_md(spec, functions, main_steps),
    }

#Making it work for internal testing, disk only
def write_to_disk(files: dict, out_dir="generated"):
    out = Path(out_dir); out.mkdir(exist_ok=True)
    for filename, contents in files.items():
        (out / filename).write_text(contents)


if __name__ == "__main__":
    spec_file = sys.argv[1] if len(sys.argv) > 1 else "scheduling.yaml"
    try:
        spec = yaml.safe_load(Path(spec_file).read_text())
        files = generate(spec)
        write_to_disk(files)
        print("Wrote skeleton to ./generated/")
    except SpecError as e:
        print(
            f"\n  There is a problem with your spec file:\n\n    {e}\n", file=sys.stderr)
        sys.exit(1)
