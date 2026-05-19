"""
One-time script to normalize duplicate project names in the work_items table.

Groups project names that differ only by casing or whitespace, then updates
all variants to the most frequently used spelling.

Usage:
    python -m backend.normalize_projects          # dry-run (default)
    python -m backend.normalize_projects --apply  # apply changes
"""

import sys
from collections import Counter

from sqlalchemy import text

from backend.database import engine


def normalize_key(name: str) -> str:
    return name.strip().lower().replace(" ", "").replace("-", "").replace("_", "")


def main():
    apply = "--apply" in sys.argv

    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, project_name FROM work_items WHERE project_name IS NOT NULL AND project_name != ''")
        ).fetchall()

    # Group by normalized key
    groups: dict[str, list[tuple[str, str]]] = {}
    for row_id, name in rows:
        key = normalize_key(name)
        groups.setdefault(key, []).append((row_id, name))

    # Find groups with more than one spelling variant
    fixes: list[tuple[str, str, str]] = []  # (id, old_name, canonical)
    for key, members in groups.items():
        variants = set(name for _, name in members)
        if len(variants) <= 1:
            continue

        # Pick the most common spelling as canonical
        counts = Counter(name for _, name in members)
        canonical = counts.most_common(1)[0][0]

        print(f"\n  Normalized key: '{key}'")
        print(f"  Variants found: {dict(counts)}")
        print(f"  Canonical name: '{canonical}'")

        for row_id, name in members:
            if name != canonical:
                fixes.append((row_id, name, canonical))

    if not fixes:
        print("\nNo duplicate project names found. Database is clean.")
        return

    print(f"\n{'=' * 60}")
    print(f"Total rows to update: {len(fixes)}")

    if not apply:
        print("\nDry run — no changes made. Run with --apply to fix.")
        return

    with engine.begin() as conn:
        for row_id, old_name, canonical in fixes:
            conn.execute(
                text("UPDATE work_items SET project_name = :canonical WHERE id = :id"),
                {"canonical": canonical, "id": row_id},
            )
            print(f"  Updated '{old_name}' → '{canonical}' (id={row_id})")

    print(f"\nDone. Updated {len(fixes)} rows.")


if __name__ == "__main__":
    main()
