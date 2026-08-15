from __future__ import annotations
import yaml

# Indicates which ln in the spec holds the syntax error


def _snippet(lines: list[str], line_idx: int, col_idx: int | None) -> str:
    line_idx = max(0, min(line_idx, len(lines) - 1)) if lines else 0
    text = lines[line_idx] if lines else ""
    out = f"    {text}"
    if col_idx is not None:
        out += "\n" + " " * (4 + min(col_idx, len(text))) + "^"
    return out


def friendly_yaml_error(exc: yaml.YAMLError, source: str) -> str:
    lines = source.splitlines()
    context = getattr(exc, "context", None)
    context_mark = getattr(exc, "context_mark", None)
    problem = getattr(exc, "problem", None)
    problem_mark = getattr(exc, "problem_mark", None)

    # Unclosed curly braces error 
    # context_mark reliably points at the opening brace as "while parsing a flow mapping"
    if context == "while parsing a flow mapping" and context_mark is not None:
        line_no = context_mark.line + 1
        return (
            f"Your YAML has an unclosed `{{` on line {line_no}:\n\n"
            f"{_snippet(lines, context_mark.line, context_mark.column)}\n\n"
            f"Every `{{` that starts a flow-style mapping (like "
            f"`{{ who: Ana, amount: 30.0 }}`) needs a matching `}}` before "
            f"the mapping ends. Check that this one is closed."
        )

    # Missing colon between the key and assigned value like key: value
    if problem == "could not find expected ':'" and problem_mark is not None:
        line_no = problem_mark.line + 1
        return (
            f"Missing colon on line {line_no}:\n\n"
            f"{_snippet(lines, problem_mark.line, problem_mark.column)}\n\n"
            f"This line looks like it's meant to be a `key: value` pair "
            f"but is missing its colon."
        )

    # Ambiguous stray colon for a missing colon in a block mapping where the
    # malformed line comes before a valid sibling, or a missing opening `{`
    # before a flow-style mapping. There's no reliable way to tell which
    # from the exception alone, so the message covers both.
    if problem == "mapping values are not allowed here" and problem_mark is not None:
        line_no = problem_mark.line + 1
        return (
            f"Unexpected `:` on line {line_no}:\n\n"
            f"{_snippet(lines, problem_mark.line, problem_mark.column)}\n\n"
            f"This usually means one of two things: a `key: value` pair "
            f"earlier is missing its own colon, or a flow-style mapping "
            f"like `{{ key: value, key2: value2 }}` is missing its opening "
            f"`{{`. Check the line(s) above this one."
        )

    # Fallback: any other MarkedYAMLError shape that hasn't yet been special-cased.
    # Still show line number + snippet instead of PyYAML's raw ASCII dump.
    mark = problem_mark or context_mark
    if mark is not None:
        line_no = mark.line + 1
        problem_text = problem or str(exc)
        return (
            f"There's a YAML formatting problem on line {line_no}:\n\n"
            f"{_snippet(lines, mark.line, mark.column)}\n\n"
            f"({problem_text})"
        )

    # Unlikely but no marks at all (rare, e.g. encoding errors).
    return f"Invalid YAML: {exc}"



#tf they mean by block mapping?