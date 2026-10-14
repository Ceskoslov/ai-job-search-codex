#!/usr/bin/env python3
"""Create missing ignored profile files from the versioned blank templates.

Existing files are never overwritten. Template updates are reviewed separately
before they are reflected in an already populated personal workspace.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = ROOT / ".claude" / "profile-templates"


def initialize(templates: Path = TEMPLATES, workspace: Path = ROOT) -> list[str]:
    created = []
    for source in sorted(templates.rglob("*")):
        if not source.is_file():
            continue
        relative = source.relative_to(templates)
        destination = workspace / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        try:
            with destination.open("xb") as output:
                output.write(source.read_bytes())
        except FileExistsError:
            continue
        created.append(relative.as_posix())
    return created


if __name__ == "__main__":
    for filename in initialize():
        print(f"Created local profile template: {filename}")
