#!/usr/bin/env python3
"""
stitch.py — assemble Index.html into a preview file for local testing.

Mirrors Apps Script serve-time template evaluation. --theme and --data are
independent axes: use either, both, or neither.

TAG RESOLUTION TABLE
  Tag                              --theme only   --theme --data
  ─────────────────────────────────────────────────────────────
  <?!= include('Theme' + theme) ?> resolved       resolved
  <?!= include('X') ?>             resolved       resolved
  <?!= JSON.stringify(data) ?>     left as-is     TestData{View}.html inlined
  <?!= data.X ?>                   _MOCK_DATA_FIELDS  TestData JSON value
  <?= data.X ?>  (or nested path)  left as-is     TestData JSON value (escaped)

--theme only  -> color/structure check; data tags remain as template placeholders
--data added  -> fully rendered preview; data values substituted from TestData JSON

Themes:  Default | SoftPurple | Matcha | Gummy
Views:   Office | Home | Weekend | Logged | Fatal | Unauth
Output:  HTML_StitchOutput/_preview_{theme}[_{view}].html

Usage:
  python stitch.py --help
  python stitch.py --theme Default                     color variant, no data resolved
  python stitch.py --theme Default --data Office       fully rendered Office preview
  python stitch.py --theme Matcha  --data Fatal        fully rendered Fatal preview
  python stitch.py --all                               all 4 color variants
  python stitch.py --all --data Office                 all 4 fully rendered with Office data
  python stitch.py --theme Default --data Office --dry-run
  python stitch.py --theme Default --check REF         compare output against REF file
  python stitch.py --all --check-dir DIR               compare all 4 against DIR/ui_preview_*.html
"""

import argparse
import difflib
import json
import re
import sys
from pathlib import Path

HERE           = Path(__file__).parent                                    # nfc_relay/HTML/Helpers/
COMPONENTS_DIR = HERE.parent.parent / 'OfficeDayTracker_AppScript'       # nfc_relay/OfficeDayTracker_AppScript/
OUTPUT_DIR     = HERE.parent / 'HTML_StitchOutput'                       # nfc_relay/HTML/HTML_StitchOutput/
TEST_DATA_DIR  = HERE.parent / 'TestData'                                 # nfc_relay/HTML/TestData/
ENTRY          = COMPONENTS_DIR / 'Index.html'

THEMES = ['Default', 'SoftPurple', 'Matcha', 'Gummy']
VIEWS  = ['Office', 'Home', 'Weekend', 'Logged', 'Fatal', 'Unauth']

# Maps theme name -> output file stem and retheme.py reference file name
_THEME_META = {
    'Default':     ('_preview_default',      'ui_preview_default.html'),
    'SoftPurple':  ('_preview_soft_purple',  'ui_preview_soft_purple.html'),
    'Matcha':      ('_preview_matcha',       'ui_preview_matcha.html'),
    'Gummy':       ('_preview_gummy',        'ui_preview_gummy.html'),
}

_DATA_TAG         = re.compile(r'<\?!=\s*JSON\.stringify\(data\)\s*\?>')
_DATA_FIELD_TAG   = re.compile(r'<\?!=\s*data\.(\w+)\s*\?>')                   # unescaped  <?!= data.X ?>
_DATA_ESCAPED_TAG = re.compile(r'<\?=\s*data\.([\w]+(?:\.[\w]+)*)\s*\?>')      # escaped    <?=  data.X.Y.Z ?>
_INCLUDE_TAG      = re.compile(r"<\?!=\s*include\(['\"](\w+)['\"]\)\s*\?>")
_THEME_TAG        = re.compile(r"<\?!=\s*include\(['\"]Theme['\"]\s*\+\s*theme\)\s*\?>")

# Fallback mock values for <?!= data.X ?> when no --data flag is given
_MOCK_DATA_FIELDS = {
    'errorMessage': 'Could not load spreadsheet data. Check that the sheet is accessible and try again.',
    'isDark':       'false',
}


def _get_nested(obj, path):
    """Return value at dot-separated path in a nested dict, or None if missing."""
    for part in path.split('.'):
        if not isinstance(obj, dict):
            return None
        obj = obj.get(part)
    return obj


def _load_test_data(view):
    """Parse TestData{View}.html (or TestData.html) as JSON. Returns dict or None."""
    candidates = []
    if view:
        candidates.append(TEST_DATA_DIR / f'TestData{view}.html')
    candidates.append(TEST_DATA_DIR / 'TestData.html')
    for path in candidates:
        if path.exists():
            try:
                return json.loads(path.read_text(encoding='utf-8'))
            except json.JSONDecodeError as e:
                print(f'  WARN  {path.name}: invalid JSON — {e}', file=sys.stderr)
                return None
    return None


def resolve(content, theme=None, view=None, data_obj=None, depth=0):
    """Recursively resolve all template tags in content.

    theme:    Theme name (e.g. 'Matcha') — resolves include('Theme' + theme).
              If None, the tag becomes an HTML comment.
    view:     View name (e.g. 'Office') — selects TestData{View}.html for the
              JSON.stringify(data) tag. Falls back to TestData.html if absent.
    data_obj: Parsed TestData JSON dict. When provided:
                <?= data.X.Y ?>   resolved via _get_nested (escaped output)
                <?!= data.X ?>    resolved from dict, falls back to _MOCK_DATA_FIELDS
              When None, <?= data.X ?> tags are left as-is.
    Raises RecursionError at depth > 20 (cycle guard).
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
        return resolve(path.read_text(encoding='utf-8'), theme, view, data_obj, depth + 1)

    def _sub_data(_m):
        candidates = []
        if view:
            candidates.append(TEST_DATA_DIR / f'TestData{view}.html')
        candidates.append(TEST_DATA_DIR / 'TestData.html')
        for path in candidates:
            if path.exists():
                return path.read_text(encoding='utf-8')
        names = ' / '.join(p.name for p in candidates)
        print(f'  WARN  {names} not found — data tag left unresolved', file=sys.stderr)
        return _m.group(0)

    def _sub_data_field(m):
        key = m.group(1)
        if data_obj is not None:
            val = data_obj.get(key)
            if val is not None:
                return str(val)
        return _MOCK_DATA_FIELDS.get(key, f'[mock: data.{key}]')

    def _sub_data_escaped(m):
        path = m.group(1)
        if data_obj is None:
            return m.group(0)  # no --data: leave tag as-is
        val = _get_nested(data_obj, path)
        if val is None:
            print(f'  WARN  data.{path} not found in TestData', file=sys.stderr)
            return f'[missing: data.{path}]'
        return str(val)

    def _sub_include(m):
        name = m.group(1)
        path = COMPONENTS_DIR / f'{name}.html'
        if not path.exists():
            print(f'  WARN  {name}.html not found', file=sys.stderr)
            return f'<!-- stitch: missing {name}.html -->'
        return resolve(path.read_text(encoding='utf-8'), theme, view, data_obj, depth + 1)

    # Order matters: theme before include (avoids regex collision);
    # data tags before include (so inlined JS/HTML is not re-scanned for tags)
    content = _THEME_TAG.sub(_sub_theme, content)
    content = _DATA_TAG.sub(_sub_data, content)
    content = _DATA_FIELD_TAG.sub(_sub_data_field, content)
    content = _DATA_ESCAPED_TAG.sub(_sub_data_escaped, content)
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


def run_theme(theme, view=None, check_ref=None, dry_run=False):
    """Assemble and optionally check one theme variant. Returns True on success."""
    if not ENTRY.exists():
        print(f'  ERROR  {ENTRY} not found', file=sys.stderr)
        return False

    stem, _ = _THEME_META[theme]
    suffix   = f'_{view.lower()}' if view else ''
    output   = OUTPUT_DIR / f'{stem}{suffix}.html'
    data_obj = _load_test_data(view) if view else None
    result   = resolve(ENTRY.read_text(encoding='utf-8'), theme, view, data_obj)
    lines    = len(result.splitlines())

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
            'Assemble Index.html into a preview file for local testing.\n'
            'Mirrors Apps Script serve-time template evaluation.\n\n'
            '--theme and --data are independent: use either, both, or neither.\n\n'
            '  --theme only   : color/structure check; <?= data.X ?> tags left as-is\n'
            '  --data only    : data resolved; theme CSS left as HTML comment\n'
            '  both           : fully rendered preview (recommended for feature work)\n\n'
            'Examples:\n'
            '  python stitch.py --theme Default                    color variant\n'
            '  python stitch.py --theme Default --data Office      full Office preview\n'
            '  python stitch.py --theme Matcha  --data Fatal       full Fatal preview\n'
            '  python stitch.py --all                              all 4 color variants\n'
            '  python stitch.py --all --data Office                all 4 + Office data\n'
            '  python stitch.py --theme Default --data Office --dry-run\n'
            '  python stitch.py --theme Default --check REF        diff against REF\n'
            '  python stitch.py --all --check-dir DIR              diff all 4 variants\n'
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        '--theme', choices=THEMES, metavar='NAME',
        help=(
            f'Theme to resolve. Inlines Theme{{NAME}}.html CSS into the output. '
            f'Choices: {", ".join(THEMES)}.'
        ),
    )
    parser.add_argument(
        '--data', choices=VIEWS, metavar='VIEW',
        help=(
            f'View data to inject. Loads TestData{{VIEW}}.html from HTML/TestData/, '
            f'inlines it at the JSON.stringify tag, and resolves all <?= data.X ?> '
            f'template tags from the same JSON. '
            f'Choices: {", ".join(VIEWS)}.'
        ),
    )
    parser.add_argument(
        '--all', action='store_true',
        help='Generate all 4 themed previews in one pass. Combine with --data to also resolve data tags.',
    )
    parser.add_argument(
        '--check', metavar='REF',
        help='(Single --theme) Compare output against REF file. Exit 1 if different.',
    )
    parser.add_argument(
        '--check-dir', metavar='DIR',
        help='(--all) Compare each output against DIR/ui_preview_*.html. Exit 1 if any fail.',
    )
    parser.add_argument(
        '--dry-run', action='store_true',
        help='Resolve and print line counts without writing any files.',
    )
    args = parser.parse_args()

    if not args.theme and not args.all:
        # No theme — write _preview.html without theme resolution (skeleton test)
        if not ENTRY.exists():
            print(f'  ERROR  {ENTRY} not found', file=sys.stderr)
            sys.exit(1)
        data_obj = _load_test_data(args.data) if args.data else None
        result   = resolve(ENTRY.read_text(encoding='utf-8'), view=args.data, data_obj=data_obj)
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
            ok  = run_theme(t, view=args.data, check_ref=ref, dry_run=args.dry_run)
            all_ok = all_ok and ok
        print('Done.')
        if not all_ok:
            sys.exit(1)
        return

    # Single theme
    _, ref_name = _THEME_META[args.theme]
    ok = run_theme(args.theme, view=args.data, check_ref=args.check, dry_run=args.dry_run)
    print('Done.')
    if not ok:
        sys.exit(1)


if __name__ == '__main__':
    main()
