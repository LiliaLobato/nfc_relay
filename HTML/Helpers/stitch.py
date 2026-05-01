#!/usr/bin/env python3
"""
stitch.py — assemble Index.html into a preview file for local testing.

Mirrors Apps Script serve-time template evaluation. --theme and --data are
independent axes: use either, both, or neither.

TAG RESOLUTION TABLE
  Tag                               --theme only        --theme --data
  <?!= include('Theme' + theme) ?>  resolved            resolved
  <?!= include('X') ?>              resolved            resolved
  <?!= JSON.stringify(data) ?>      left as-is          TestData{View}.html inlined
  <?!= data.X ?>                    [mock: data.X]      TestData JSON value
  <?=  data.X.Y.Z ?>                left as-is          TestData JSON value (escaped)

Themes:  Default | SoftPurple | Matcha | Gummy
Views:   Office | Home | Weekend | Logged | Fatal | Unauth
Output:  HTML_StitchOutput/_preview_{theme}[_{view}].html

Usage:
  python stitch.py --theme Default                     color variant, no data resolved
  python stitch.py --theme Default --data Office       fully rendered Office preview
  python stitch.py --theme Matcha  --data Fatal        fully rendered Fatal preview
  python stitch.py --all                               all 4 color variants
  python stitch.py --all --data Office                 all 4 fully rendered with Office data
  python stitch.py --theme Default --data Office --dry-run
"""

import argparse
import json
import re
import sys
from pathlib import Path

HERE           = Path(__file__).parent
COMPONENTS_DIR = HERE.parent.parent / 'OfficeDayTracker_AppScript'
OUTPUT_DIR     = HERE.parent / 'HTML_StitchOutput'
TEST_DATA_DIR  = HERE.parent / 'TestData'
ENTRY          = COMPONENTS_DIR / 'Index.html'

THEMES = ['Default', 'SoftPurple', 'Matcha', 'Gummy']
VIEWS  = ['Office', 'Home', 'Weekend', 'Logged', 'Fatal', 'Unauth']

# office/home/weekend/logged all render into view-main (one shared component set)
MAIN_VIEWS = {'office', 'home', 'weekend', 'logged'}

THEME_STEMS = {
    'Default':    '_preview_default',
    'SoftPurple': '_preview_soft_purple',
    'Matcha':     '_preview_matcha',
    'Gummy':      '_preview_gummy',
}

_DATA_TAG         = re.compile(r'<\?!=\s*JSON\.stringify\(data\)\s*\?>')
_DATA_FIELD_TAG   = re.compile(r'<\?!=\s*data\.(\w+)\s*\?>')
_DATA_ESCAPED_TAG = re.compile(r'<\?=\s*data\.([\w]+(?:\.[\w]+)*)\s*\?>')
_INCLUDE_TAG      = re.compile(r"<\?!=\s*include\(['\"](\w+)['\"]\)\s*\?>")
_THEME_TAG        = re.compile(r"<\?!=\s*include\(['\"]Theme['\"]\s*\+\s*theme\)\s*\?>")

_MOCK_DATA_FIELDS = {
    'errorMessage': 'Could not load spreadsheet data. Check that the sheet is accessible and try again.',
    'isDark':       'false',
}


def _get_nested(obj, path):
    for part in path.split('.'):
        if not isinstance(obj, dict):
            return None
        obj = obj.get(part)
    return obj


def _load_test_data(view):
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
    if depth > 20:
        raise RecursionError('include depth > 20 — possible cycle')

    def _sub_theme(_m):
        if not theme:
            return '<!-- stitch: Theme not resolved (no --theme given) -->'
        path = COMPONENTS_DIR / f'Theme{theme}.html'
        if not path.exists():
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
                return ('true' if val else 'false') if isinstance(val, bool) else str(val)
        return _MOCK_DATA_FIELDS.get(key, f'[mock: data.{key}]')

    def _sub_data_escaped(m):
        path = m.group(1)
        if data_obj is None:
            return m.group(0)
        val = _get_nested(data_obj, path)
        if val is None:
            print(f'  WARN  data.{path} not found in TestData', file=sys.stderr)
            return f'[missing: data.{path}]'
        return ('true' if val else 'false') if isinstance(val, bool) else str(val)

    def _sub_include(m):
        name = m.group(1)
        path = COMPONENTS_DIR / f'{name}.html'
        if not path.exists():
            return f'<!-- stitch: missing {name}.html -->'
        return resolve(path.read_text(encoding='utf-8'), theme, view, data_obj, depth + 1)

    # isDark is a server-side Apps Script variable, not in data — always light in preview
    content = content.replace("<?!= isDark ? 'dark' : '' ?>", '')
    content = _THEME_TAG.sub(_sub_theme, content)
    content = _DATA_TAG.sub(_sub_data, content)
    content = _DATA_FIELD_TAG.sub(_sub_data_field, content)
    content = _DATA_ESCAPED_TAG.sub(_sub_data_escaped, content)
    content = _INCLUDE_TAG.sub(_sub_include, content)
    return content


def run_theme(theme, view=None, dry_run=False):
    if not ENTRY.exists():
        print(f'  ERROR  {ENTRY} not found', file=sys.stderr)
        return False

    stem     = THEME_STEMS[theme]
    suffix   = f'_{view.lower()}' if view else ''
    output   = OUTPUT_DIR / f'{stem}{suffix}.html'
    data_obj = _load_test_data(view) if view else None
    result   = resolve(ENTRY.read_text(encoding='utf-8'), theme, view, data_obj)

    if view:
        target_id = 'view-main' if view.lower() in MAIN_VIEWS else f'view-{view.lower()}'
        result = result.replace(' class="view active"', ' class="view"')
        result = result.replace(
            f'id="{target_id}" class="view"',
            f'id="{target_id}" class="view active"',
        )

    lines = len(result.splitlines())
    if dry_run:
        print(f'  --  {output.name}  ({lines} lines)  (not written)')
        return True

    output.write_text(result, encoding='utf-8')
    print(f'  OK  {output.name}  ({lines} lines)')
    return True


def main():
    parser = argparse.ArgumentParser(
        prog='stitch.py',
        description=(
            'Assemble Index.html into a preview file for local testing.\n'
            'Mirrors Apps Script serve-time template evaluation.\n\n'
            'Examples:\n'
            '  python stitch.py --theme Default\n'
            '  python stitch.py --theme Default --data Office\n'
            '  python stitch.py --all --data Home\n'
            '  python stitch.py --theme Default --data Office --dry-run\n'
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--theme', choices=THEMES, metavar='NAME',
                        help=f'Theme to resolve. Choices: {", ".join(THEMES)}.')
    parser.add_argument('--data', choices=VIEWS, metavar='VIEW',
                        help=f'View data to inject. Choices: {", ".join(VIEWS)}.')
    parser.add_argument('--all', action='store_true',
                        help='Generate all 4 themed previews in one pass.')
    parser.add_argument('--dry-run', action='store_true',
                        help='Resolve and print line counts without writing files.')
    args = parser.parse_args()

    if args.all:
        for t in THEMES:
            run_theme(t, view=args.data, dry_run=args.dry_run)
        print('Done.')
        return

    if not args.theme:
        # No theme — skeleton test without CSS
        data_obj = _load_test_data(args.data) if args.data else None
        result   = resolve(ENTRY.read_text(encoding='utf-8'), view=args.data, data_obj=data_obj)
        lines    = len(result.splitlines())
        if args.dry_run:
            print(f'Dry run - {lines} lines resolved, no file written.')
        else:
            output = OUTPUT_DIR / '_preview.html'
            output.write_text(result, encoding='utf-8')
            print(f'  OK  {output.name}  ({lines} lines)')
        print('Done.')
        return

    run_theme(args.theme, view=args.data, dry_run=args.dry_run)
    print('Done.')


if __name__ == '__main__':
    main()
