#!/usr/bin/env python3
"""Structural and secret checks for every plugin in this marketplace.

Each plugin listed in .claude-plugin/marketplace.json must have a manifest whose name matches its listing, ship no MCP
server (each device registers its instance at user scope and holds its own token), give every skill YAML front matter
with its directory name and a description, and give every shared-contract directory (a leading "_") a README. No file
may carry a credential or an account id, and no file or path may name a tenant (this script, which lists the terms,
excepted). Exits non-zero with one line per problem.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SECRETS = [
    ("a GUID (subscription or tenant id)", re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I)),
    ("a 32+ hex-digit id or key", re.compile(r"[0-9a-f]{32,}", re.I)),
    ("a registry token", re.compile(r"mk_[A-Za-z0-9_\-]{12,}")),
    ("a GitHub token", re.compile(r"(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})")),
    ("a private key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY")),
    ("a JWT", re.compile(r"eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}")),
    ("a literal bearer credential", re.compile(r"Bearer\s+['\"]?(?![$<…])[A-Za-z0-9._~+/\-]{16,}", re.I)),
]

# The plugins are generic: no tenant's product, repository or host names. These are the terms of tenants whose
# skills were the model for this plugin; "meshnet" covers every repository named after it. A tenant's own terms
# belong in that tenant's layer plugin, never here. Person names are deliberately not listed (this repo is public).
TENANT_TERMS = [
    ("meshnet", re.compile(r"meshnet", re.I)),
    ("vo.cab", re.compile(r"vo\.cab", re.I)),
]
# Zero-width characters a pasted name can carry; they are removed before matching.
INVISIBLE = re.compile("[" + chr(0x200B) + "-" + chr(0x200D) + chr(0x2060) + chr(0xFEFF) + "]")


def front_matter(text):
    lines = text.replace("\r\n", "\n").split("\n")
    if len(lines) < 3 or lines[0] != "---":
        raise ValueError("no front matter: the file must start with a '---' line")
    try:
        end = lines.index("---", 1)
    except ValueError:
        raise ValueError("front matter is not closed by a '---' line")
    keys = {}
    for n, line in enumerate(lines[1:end], start=2):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        m = re.match(r"^([A-Za-z_][\w-]*):(?: (.*))?$", line)
        if not m:
            raise ValueError(f"line {n}: expected 'key: value' on one line")
        value = (m.group(2) or "").strip()
        if value[:1] not in ('"', "'") and (": " in value or value.endswith(":")):
            raise ValueError(f"line {n}: an unquoted value may not contain ': '; quote it")
        if value[:1] == '"' and (len(value) < 2 or not value.endswith('"') or '"' in value[1:-1].replace(chr(92) + '"', "")):
            raise ValueError(f"line {n}: a double-quoted value must end with its quote and escape any quote inside it")
        keys[m.group(1)] = value.strip("'\"")
    return keys


def repo_files():
    return sorted(p for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.relative_to(ROOT).parts)


def read_lines(path):
    """Every file as text: UTF-16 by its byte-order mark, else UTF-8, else Latin-1, so nothing is skipped unread."""
    data = path.read_bytes()
    if data.startswith((b"\xff\xfe", b"\xfe\xff")):
        text = data.decode("utf-16")
    else:
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = data.decode("latin-1")
    return text.splitlines()


def main():
    problems = []
    market = json.loads((ROOT / ".claude-plugin" / "marketplace.json").read_text(encoding="utf-8"))
    plugins = market.get("plugins") or []
    if not plugins:
        problems.append("marketplace.json lists no plugins")
    for entry in plugins:
        root = (ROOT / entry["source"]).resolve()
        rel = root.relative_to(ROOT)
        manifest_path = root / ".claude-plugin" / "plugin.json"
        if not manifest_path.is_file():
            problems.append(f"{rel}: no .claude-plugin/plugin.json")
            continue
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("name") != entry["name"]:
            problems.append(f"{rel}: plugin.json names '{manifest.get('name')}', the marketplace lists '{entry['name']}'")
        if "mcpServers" in manifest or (root / ".mcp.json").exists():
            problems.append(f"{rel}: ships an MCP server; each device registers its instance at user scope instead")
        skills = root / manifest.get("skills", "./skills/")
        dirs = sorted(d for d in skills.iterdir() if d.is_dir()) if skills.is_dir() else []
        if not any((d / "SKILL.md").is_file() for d in dirs):
            problems.append(f"{rel}: no skills")
        for d in dirs:
            if d.name.startswith("_"):
                if not (d / "README.md").is_file():
                    problems.append(f"{rel}/skills/{d.name}: a shared contract needs README.md")
                continue
            skill = d / "SKILL.md"
            if not skill.is_file():
                problems.append(f"{rel}/skills/{d.name}: needs SKILL.md")
                continue
            try:
                keys = front_matter(skill.read_text(encoding="utf-8"))
            except ValueError as e:
                problems.append(f"{rel}/skills/{d.name}/SKILL.md: {e}")
                continue
            if keys.get("name") != d.name:
                problems.append(f"{rel}/skills/{d.name}/SKILL.md: name must be '{d.name}'")
            if not keys.get("description"):
                problems.append(f"{rel}/skills/{d.name}/SKILL.md: description is required")

    this = Path(__file__).resolve()
    for path in repo_files():
        if path.name == "LICENSE":
            continue
        lines = read_lines(path)
        for n, line in enumerate(lines, start=1):
            for what, pattern in SECRETS:
                # This script defines the patterns, so skip its own pattern lines.
                if path == this and "re.compile" in line:
                    continue
                if pattern.search(line):
                    problems.append(f"{path.relative_to(ROOT)}:{n} has {what}")

    # Every file in the repository, its path included; this script is the one place the terms are written.
    for path in repo_files():
        if path == this:
            continue
        rel = path.relative_to(ROOT)
        for term, pattern in TENANT_TERMS:
            if pattern.search(INVISIBLE.sub("", rel.as_posix())):
                problems.append(f"{rel}: its path names a tenant ('{term}'); keep the plugin generic")
        for n, line in enumerate(read_lines(path), start=1):
            for term, pattern in TENANT_TERMS:
                if pattern.search(INVISIBLE.sub("", line)):
                    problems.append(f"{rel}:{n} names a tenant ('{term}'); keep the plugin generic")

    for p in problems:
        print(p)
    print(f"{len(problems)} problem(s)" if problems else "all checks passed")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
