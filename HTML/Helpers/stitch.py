#!/usr/bin/env python3
"""
stitch.py — assemble Index.html into a single preview file for local testing.

Resolves Apps Script template tags the same way the server does at serve time:
  <?!= include('X') ?>              → inlined content of X.html       (recursive)
  <?!= include('Theme' + theme) ?>  → inlined content of Theme{Name}.html (theme-aware)
  <?!= JSON.stringify(data) ?>      → inlined content of TestData.html (special rule)
  <?!= data.X ?>                    → mock value from _MOCK_DATA_FIELDS dict

TestData.html is a local dev-only file and is never pushed to Apps Script.

Themes:   Default | SoftPurple | Matcha | Gummy
Sources:  *.html files in same directory as this script
Output:   _preview_{theme}.html  (or _preview.html when no --theme given)

Usage:
  python stitch.py                              write _preview.html (no theme resolved)
  python stitch.py --theme Matcha               write _preview_matcha.html
  python stitch.py --theme Matcha --check REF   write + compare against REF; exit 1 if different
  python stitch.py --theme Matcha --dry-run     resolve and print stats without writing
  python stitch.py --all                        write all 4 themed previews
  python stitch.py --all --check-dir DIR        write all 4 + check each against DIR/ui_preview_*.html
"""

import argparse
import difflib
import re
import sys
from pathlib import Path

HERE           = Path(__file__).parent                                    # nfc_relay/HTML/Helpers/
COMPONENTS_DIR = HERE.parent.parent / 'OfficeDayTracker_AppScript'       # nfc_relay/OfficeDayTracker_AppScript/
OUTPUT_DIR     = HERE.parent / 'HTML_StitchOutput'                       # nfc_relay/HTML/HTML_StitchOutput/
ENTRY          = COMPONENTS_DIR / 'Index.html'
TEST_DATA      = COMPONENTS_DIR / 'TestData.html'

THEMES = ['Default', 'SoftPurple', 'Matcha', 'Gummy']

# Maps theme name → output file stem and retheme.py reference file name
_THEME_META = {
    'Default':     ('_preview_default',      'ui_preview_default.html'),
    'SoftPurple':  ('_preview_soft_purple',  'ui_preview_soft_purple.html'),
    'Matcha':      ('_preview_matcha',       'ui_preview_matcha.html'),
    'Gummy':       ('_preview_gummy',        'ui_preview_gummy.html'),
}

_DATA_TAG       = re.compile(r'<\?!=\s*JSON\.stringify\(data\)\s*\?>')
_DATA_FIELD_TAG = re.compile(r'<\?!=\s*data\.(\w+)\s*\?>')
_INCLUDE_TAG    = re.compile(r"<\?!=\s*include\(['\"](\w+)['\"]\)\s*\?>")
_THEME_TAG      = re.compile(r"<\?!=\s*include\(['\"]Theme['\"]\s*\+\s*theme\)\s*\?>")

# Mock values for data.X field tags (used by FatalErrorCard and similar templates)
_MOCK_DATA_FIELDS = {
    'errorMessage': 'Could not load spreadsheet data. Check that the sheet is accessible and try again.',
    'isDark':       'false',
}


def resolve(content, theme=None, depth=0):
    """Recursively resolve all template tags in content.

    theme:  concrete theme name (e.g. 'Matcha') used to resolve the dynamic
            include('Theme' + theme) tag. If None, the tag is left as a comment.
    Raises RecursionError if include depth exceeds 20 (cycle guard).
    Prints a warning and injects an HTML comment for any missing file.
    """
    if depth > 20:
        raise RecursionError('include depth > 20 — possible cycle')

    def _sub_theme(_m):
        if not theme:
            print('  WARN  --theme not set; Theme include left as comment', file=sys.stderr)
            return '<!-- stitch: Theme not resolved (no --theme given) -->'
        path = COMPONENTS_DIR / f'Theme{theme}.html'
        if not path.exists():
            print(f'  WARN  Theme{theme}.html not found', file=sys.stderr)
            return f'<!-- stitch: missing Theme{theme}.html -->'
        return resolve(path.read_text(encoding='utf-8'), theme, depth + 1)

    def _sub_data(_m):
        if not TEST_DATA.exists():
            print('  WARN  TestData.html not found — data tag left unresolved', file=sys.stderr)
            return _m.group(0)
        return TEST_DATA.read_text(encoding='utf-8')

    def _sub_data_field(m):
        key = m.group(1)
        return _MOCK_DATA_FIELDS.get(key, f'[mock: data.{key}]')

    def _sub_include(m):
        name = m.group(1)
        path = COMPONENTS_DIR / f'{name}.html'
        if not path.exists():
            print(f'  WARN  {name}.html not found', file=sys.stderr)
            return f'<!-- stitch: missing {name}.html -->'
        return resolve(path.read_text(encoding='utf-8'), theme, depth + 1)

    # Order matters: resolve theme tag before general include (avoids regex collision)
    content = _THEME_TAG.sub(_sub_theme, content)
    content = _DATA_TAG.sub(_sub_data, content)
    content = _DATA_FIELD_TAG.sub(_sub_data_field, content)
    content = _INCLUDE_TAG.sub(_sub_include, content)
    return content


def _normalize(text):
    """Strip trailing whitespace per line and drop blank lines for comparison."""
    return [line.rstrip() for line in text.splitlines() if line.strip()]


def check_against(output_text, output_name, ref_path):
    """Compare output_text against ref_path line-by-line (whitespace-normalized).

    Prints OK or a unified diff of the first differences. Returns True if identical.
    """
    if not ref_path.exists():
        print(f'  ERROR  reference not found: {ref_path}', file=sys.stderr)
        return False

    ref_text  = ref_path.read_text(encoding='utf-8')
    out_lines = _normalize(output_text)
    ref_lines = _normalize(ref_text)

    if out_lines == ref_lines:
        print(f'  OK  {output_name} matches reference')
        return True

    diffs = list(difflib.unified_diff(
        ref_lines, out_lines,
        fromfile=ref_path.name,
        tofile=output_name,
        lineterm='',
    ))
    n = len([d for d in diffs if d.startswith(('+', '-')) and not d.startswith(('+++', '---'))])
    print(f'  FAIL  {output_name}  {n} differing lines  (first 30 shown)')
    for line in diffs[:30]:
        print(f'    {line}')
    return False


def run_theme(theme, check_ref=None, dry_run=False):
    """Assemble and optionally check one theme variant. Returns True on success."""
    if not ENTRY.exists():
        print(f'  ERROR  {ENTRY} not found', file=sys.stderr)
        return False

    stem, _ = _THEME_META[theme]
    output  = OUTPUT_DIR / f'{stem}.html'
    result  = resolve(ENTRY.read_text(encoding='utf-8'), theme)
    lines   = len(result.splitlines())

    if dry_run:
        print(f'  --  {output.name}  ({lines} lines)  (not written)')
        return True

    output.write_text(result, encoding='utf-8')
    print(f'  OK  {output.name}  ({lines} lines)')

    if check_ref:
        return check_against(result, output.name, Path(check_ref))
    return True


def main():
    parser = argparse.ArgumentParser(
        prog='stitch.py',
        description=(
            'Assemble Index.html into themed preview files for local testing.\n'
            'Mirrors Apps Script serve-time template evaluation.\n\n'
            'Single theme:\n'
            '  python stitch.py --theme Matcha\n'
            '  python stitch.py --theme Matcha --check path/to/ui_preview_matcha.html\n\n'
            'All themes at once:\n'
            '  python stitch.py --all\n'
            '  python stitch.py --all --check-dir path/to/nfc_relay/HTML/'
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        '--theme', choices=THEMES, metavar='NAME',
        help=f'Theme to resolve. Choices: {", ".join(THEMES)}.',
    )
    parser.add_argument(
        '--all', action='store_true',
        help='Generate all 4 themed previews.',
    )
    parser.add_argument(
        '--check', metavar='REF',
        help='(Single theme) Compare output against REF. Exit 1 if different.',
    )
    parser.add_argument(
        '--check-dir', metavar='DIR',
        help='(--all) Compare each output against DIR/ui_preview_*.html. Exit 1 if any fail.',
    )
    parser.add_argument(
        '--dry-run', action='store_true',
        help='Resolve and print stats without writing any files.',
    )
    args = parser.parse_args()

    if not args.theme and not args.all:
        # No theme — write _preview.html without theme resolution (skeleton test)
        if not ENTRY.exists():
            print(f'  ERROR  {ENTRY} not found', file=sys.stderr)
            sys.exit(1)
        result = resolve(ENTRY.read_text(encoding='utf-8'))
        lines  = len(result.splitlines())
        if args.dry_run:
            print(f'Dry run - {lines} lines resolved, no file written.')
        else:
            output = OUTPUT_DIR / '_preview.html'
            output.write_text(result, encoding='utf-8')
            print(f'  OK  {output.name}  ({lines} lines)')
            if args.check:
                if not check_against(result, output.name, Path(args.check)):
                    sys.exit(1)
        print('Done.')
        return

    if args.all:
        targets   = THEMES
        check_dir = Path(args.check_dir) if args.check_dir else None
        all_ok    = True
        for t in targets:
            _, ref_name = _THEME_META[t]
            ref = str(check_dir / ref_name) if check_dir else None
            ok  = run_theme(t, check_ref=ref, dry_run=args.dry_run)
            all_ok = all_ok and ok
        print('Done.')
        if not all_ok:
            sys.exit(1)
        return

    # Single theme
    _, ref_name = _THEME_META[args.theme]
    ok = run_theme(args.theme, check_ref=args.check, dry_run=args.dry_run)
    print('Done.')
    if not ok:
        sys.exit(1)


if __name__ == '__main__':
    main()
