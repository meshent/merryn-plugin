#!/usr/bin/env python3
"""Mutation tests for scripts/check.py: each case copies the repository into a fresh git checkout, makes one change
and asserts the check fails (or passes) as it should. The tenant term comes from check.py, so this file names none.
Run: python3 scripts/test-check.py
"""
import importlib.util
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.dont_write_bytecode = True  # a __pycache__ beside check.py would be scanned (and carries its terms)
spec = importlib.util.spec_from_file_location("check", ROOT / "scripts" / "check.py")
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)
TERM = check.TENANT_TERMS[0][0]
SKILL = Path("plugins/merryn/skills/loop/SKILL.md")


def checkout():
    dest = Path(tempfile.mkdtemp(prefix="merryn-check-"))
    for f in check.repo_files():
        target = dest / f.relative_to(ROOT)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, target)
    git = ["git", "-C", str(dest), "-c", "user.name=t", "-c", "user.email=t@example.test"]
    subprocess.run(git + ["init", "-q"], check=True)
    subprocess.run(git + ["add", "-A"], check=True)
    subprocess.run(git + ["commit", "-qm", "base"], check=True)
    return dest


def run(dest, env=None):
    r = subprocess.run([sys.executable, "-B", str(dest / "scripts" / "check.py")], capture_output=True,
                       env={**os.environ, **(env or {})})
    return r.returncode, r.stdout.decode("utf-8", "replace") + r.stderr.decode("utf-8", "replace")


def with_description(dest, value):
    p = dest / SKILL
    lines = p.read_text(encoding="utf-8").split("\n")
    lines = [f"description: {value}" if l.startswith("description:") else l for l in lines]
    p.write_text("\n".join(lines), encoding="utf-8")


def soft_hyphenated(term):
    return term[:2] + chr(0xAD) + term[2:]


CASES = [
    # (name, mutate(dest), expect exit code, text the output must carry)
    ("the copy is clean", lambda d: None, 0, "all checks passed"),
    ("a term in UTF-16 without a byte-order mark",
     lambda d: (d / "notes.txt").write_bytes(f"see {TERM} here\n".encode("utf-16-le")), 1, "names a tenant"),
    ("a big-endian one too",
     lambda d: (d / "notes.txt").write_bytes(f"see {TERM} here\n".encode("utf-16-be")), 1, "names a tenant"),
    ("a term split by a soft hyphen",
     lambda d: (d / "notes.md").write_text(f"see {soft_hyphenated(TERM)}\n", encoding="utf-8"), 1, "names a tenant"),
    ("a term split by a word joiner in a path",
     lambda d: (d / f"{TERM[:2]}{chr(0x2060)}{TERM[2:]}.md").write_text("x\n", encoding="utf-8"), 1, "its path names a tenant"),
    ("an escaped backslash then a bare quote",
     lambda d: with_description(d, '"a\\\\" b"'), 1, "double-quoted value"),
    ("a quoted value followed by a comment", lambda d: with_description(d, '"x" # comment'), 0, "all checks passed"),
    ("an escaped quote inside", lambda d: with_description(d, '"say \\"hi\\" now"'), 0, "all checks passed"),
    ("an unclosed quote", lambda d: with_description(d, '"open'), 1, "double-quoted value"),
    ("a gitignored file is not scanned",
     lambda d: ((d / ".gitignore").write_text("local/\n", encoding="utf-8"),
                (d / "local").mkdir(), (d / "local" / "x.md").write_text(TERM + "\n", encoding="utf-8")), 0, "all checks passed"),
    ("an untracked, unignored file is scanned",
     lambda d: (d / "new.md").write_text(TERM + "\n", encoding="utf-8"), 1, "names a tenant"),
]


def main():
    failures = 0
    for name, mutate, want, text in CASES:
        dest = checkout()
        try:
            mutate(dest)
            code, out = run(dest)
            ok = code == want and text in out
        finally:
            shutil.rmtree(dest, ignore_errors=True)
        print(("ok   " if ok else "FAIL ") + name + ("" if ok else f": exit {code}\n{out}"))
        failures += not ok

    # A console that cannot encode a zero-width space must still get the report and exit 1, not a traceback.
    dest = checkout()
    try:
        (dest / f"a{chr(0x200B)}{TERM}.md").write_text("x\n", encoding="utf-8")
        code, out = run(dest, {"PYTHONIOENCODING": "ascii"})
        ok = code == 1 and "Traceback" not in out and "\\u200b" in out
    finally:
        shutil.rmtree(dest, ignore_errors=True)
    print(("ok   " if ok else "FAIL ") + "an unprintable path on an ASCII console" + ("" if ok else f": exit {code}\n{out}"))
    failures += not ok

    print(f"{failures} failure(s)" if failures else "all mutation tests passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
