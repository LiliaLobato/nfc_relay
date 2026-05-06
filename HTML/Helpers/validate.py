#!/usr/bin/env python3
"""
validate.py — three-layer validation of stitched Office Day Tracker output.

  Layer 1 — Health check
    Runs stitch.py --theme Default --data {View} for each full-data view and
    scans the output for [missing: data.X] placeholders. Any placeholder means
    a data tag path in a component is unresolved (mis-typed or missing from
    TestData). Fatal and Unauth are skipped — their TestData is intentionally
    minimal and the unused cards are expected to produce placeholders.

  Layer 2 — Structural spot checks
    Asserts that specific TestData values appear inside the correct HTML
    elements in the stitch output. Catches the "right field, wrong slot" class
    of bug that Layer 1 cannot see. One or two checks per card — enough to
    verify structural intent without becoming a maintenance burden.

  Layer 3 — DATA schema checks
    Extracts the inlined DATA JSON from the stitched HTML and validates that
    each field has the expected type and shape. Catches schema mismatches
    between what the JS expects and what TestData provides — e.g. a missing
    array, a dict that became a list, or a required key that was never added.
    This is the layer that would have caught charts.types being undefined.

Pipeline:
  stitch.py  →  assembles HTML, resolves tags, writes _preview_*.html
  validate.py →  calls stitch, reads output, runs all layers

Usage:
  python validate.py                    run all views, all layers
  python validate.py --view Office      run only the Office view
  python validate.py --layer 1          run only Layer 1 (health checks)
  python validate.py --layer 2          run only Layer 2 (spot checks)
  python validate.py --layer 3          run only Layer 3 (schema checks)
  python validate.py --verbose          show details on failures
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

HERE       = Path(__file__).parent
OUTPUT_DIR = HERE.parent / 'HTML_StitchOutput'
STITCH     = HERE / 'stitch.py'

# Views with full TestData — Layer 1 expects zero [missing:] placeholders.
FULL_VIEWS    = ['Office', 'Home', 'Weekend', 'Logged']
# Minimal TestData — [missing:] placeholders are expected for unused cards.
MINIMAL_VIEWS = ['Fatal', 'Unauth']
ALL_VIEWS     = FULL_VIEWS + MINIMAL_VIEWS


# ---------------------------------------------------------------------------
# Layer 2 spot checks
# Each entry: (label, view, regex_pattern)
# Pattern verifies a TestData value appears inside the correct HTML element.
# re.DOTALL is used so patterns can span tag boundaries on the same logical line.
# ---------------------------------------------------------------------------
SPOT_CHECKS = [
    # TitleCard — status class matches value, statusLabel in badge, weekNumber in header
    ('TitleCard  status-badge class + label (Office)', 'Office', r'status-badge office">Office Day<'),
    ('TitleCard  status-badge class + label (Home)',   'Home',   r'status-badge home">Home Day<'),
    ('TitleCard  weekNumber in header-ww',             'Office', r'header-ww">WW16<'),

    # RingsCard — avg values inside the correct ring-center slots
    ('RingsCard  best10of12 in ring1 center',  'Office', r'color:var\(--ring1\)">2\.4<'),
    ('RingsCard  best8of12 in ring2 center',   'Office', r'color:var\(--ring2\)">2\.8<'),
    ('RingsCard  best8of10 in ring3 center',   'Office', r'color:var\(--ring3\)">2\.1<'),
    ('RingsCard  rawAverage in absence-stat', 'Office', r'absence-stat[^<]*<strong>2\.1<'),
    ('RingsCard  projection: avg + days',     'Office', r'2\.4 days/week.{0,60}15/22'),

    # DaysCard — pill counts differ between Office (thisWeek=1) and Home (thisWeek=0)
    ('DaysCard   thisWeek in pill (Office)',  'Office', r'day-pill-count">1<'),
    ('DaysCard   thisWeek in pill (Home)',    'Home',   r'day-pill-count">0<'),
    ('DaysCard   current WW pill label',     'Office', r'day-pill-ww">WW 16<'),
    ('DaysCard   next WW pill label',        'Office', r'day-pill-ww">WW 17<'),
    ('DaysCard   projection sentence',       'Office', r'3\.3 days/week.{0,40}2 months.{0,40}3-day/week'),

    # CalendarCard — monthLabel inside cal-title
    ('CalendarCard  monthLabel (Office)', 'Office', r'cal-title">April 2026<'),
    ('CalendarCard  monthLabel (Home)',   'Home',   r'cal-title">April 2026<'),

    # ChartsBestWorst — labels and values inside correct bw-pair elements
    ('ChartsBestWorst  best weekday label',  'Office', r'month-stat">Wednesday<'),
    ('ChartsBestWorst  best weekday value',  'Office', r'color:var\(--accent\)">31<'),
    ('ChartsBestWorst  worst weekday label', 'Office', r'month-stat">Tuesday<'),
    ('ChartsBestWorst  best week label',     'Office', r'month-stat">WW5 \(2/Feb\)<'),
    ('ChartsBestWorst  worst week label',    'Office', r'month-stat">WW51 \(15/Dec/25\)<'),
    ('ChartsBestWorst  best month label',    'Office', r'month-stat">Mar<'),
    ('ChartsBestWorst  worst month label',   'Office', r'month-stat">Dec/25<'),

    # FatalErrorCard — errorMessage resolved from TestDataFatal
    ('FatalErrorCard  errorMessage resolved', 'Fatal', r'error-msg[^>]*>[^<]*Could not load spreadsheet'),
]


# ---------------------------------------------------------------------------
# Layer 3 schema checks
# Each entry: (label, dot-path, predicate, expected_description)
# Numeric path segments index into lists: 'charts.types.0.type'
# Only run on FULL_VIEWS — minimal views don't carry full chart data.
# ---------------------------------------------------------------------------
SCHEMA_CHECKS = [
    ('charts.types           non-empty array',   'charts.types',         lambda v: isinstance(v, list) and len(v) > 0,  'non-empty array'),
    ('charts.types[0].type   non-empty string',  'charts.types.0.type',  lambda v: isinstance(v, str)  and len(v) > 0,  'non-empty string'),
    ('charts.types[0].label  non-empty string',  'charts.types.0.label', lambda v: isinstance(v, str)  and len(v) > 0,  'non-empty string'),
    ('charts.week.ytd        object not array',  'charts.week.ytd',      lambda v: isinstance(v, dict),                 'object'),
    ('charts.month.ytd       object not array',  'charts.month.ytd',     lambda v: isinstance(v, dict),                 'object'),
    ('charts.year.ytd        object not array',  'charts.year.ytd',      lambda v: isinstance(v, dict),                 'object'),
    ('charts.goal            number',            'charts.goal',          lambda v: isinstance(v, (int, float)),         'number'),
    ('charts.heatmap         non-empty object',  'charts.heatmap',       lambda v: isinstance(v, dict) and len(v) > 0, 'non-empty object'),
    ('charts.week.labels     non-empty array',   'charts.week.labels',   lambda v: isinstance(v, list) and len(v) > 0, 'non-empty array'),
    ('charts.month.labels    non-empty array',   'charts.month.labels',  lambda v: isinstance(v, list) and len(v) > 0, 'non-empty array'),
    ('charts.year.labels     non-empty array',   'charts.year.labels',   lambda v: isinstance(v, list) and len(v) > 0, 'non-empty array'),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run_stitch(view):
    """Run stitch for one view. Returns (html_text, stderr_text, exit_ok)."""
    result = subprocess.run(
        [sys.executable, str(STITCH), '--theme', 'Default', '--data', view],
        capture_output=True, text=True,
    )
    path = OUTPUT_DIR / f'_preview_default_{view.lower()}.html'
    if not path.exists():
        return None, result.stderr, False
    return path.read_text(encoding='utf-8'), result.stderr, result.returncode == 0


def _build_cache(views):
    """Run stitch for each view once, return {view: html}."""
    cache = {}
    for view in views:
        html, stderr, ok = _run_stitch(view)
        cache[view] = html or ''
        if not ok and html is None:
            print(f'  ERROR  stitch failed for {view}:\n{stderr[:300]}', file=sys.stderr)
    return cache


# ---------------------------------------------------------------------------
# Layer 3
# ---------------------------------------------------------------------------

def _extract_data(html):
    """Parse the DATA object inlined in the stitched HTML via raw_decode."""
    m = re.search(r'const\s+DATA\s*=\s*', html)
    if not m:
        return None, 'const DATA not found in HTML'
    try:
        obj, _ = json.JSONDecoder().raw_decode(html, m.end())
        return obj, None
    except json.JSONDecodeError as e:
        return None, f'JSON parse error: {e}'


def _get_path(obj, path):
    """Navigate obj by dot-path; numeric segments index into lists."""
    for part in path.split('.'):
        if obj is None:
            return None
        if isinstance(obj, list):
            try:
                obj = obj[int(part)]
            except (ValueError, IndexError):
                return None
        elif isinstance(obj, dict):
            obj = obj.get(part)
        else:
            return None
    return obj


def run_layer3(views, cache, verbose=False):
    """DATA schema checks — inlined DATA must have the right types and shapes."""
    all_ok = True
    for view in views:
        if view in MINIMAL_VIEWS:
            print(f'  SKIP   L3  [{view}] minimal TestData')
            continue
        html = cache.get(view, '')
        if not html:
            print(f'  FAIL   L3  [{view}] no stitch output')
            all_ok = False
            continue
        data, err = _extract_data(html)
        if data is None:
            print(f'  FAIL   L3  [{view}] could not extract DATA: {err}')
            all_ok = False
            continue
        for label, path, predicate, expected in SCHEMA_CHECKS:
            val = _get_path(data, path)
            ok  = predicate(val)
            tag = 'OK  ' if ok else 'FAIL'
            print(f'  {tag}   L3  [{view}] {label}')
            if not ok:
                all_ok = False
                if verbose:
                    print(f'               path:     DATA.{path}')
                    print(f'               expected: {expected}')
                    print(f'               got:      {repr(val)[:80]}')
    return all_ok


# ---------------------------------------------------------------------------
# Layer 1
# ---------------------------------------------------------------------------

def run_layer1(views, cache, verbose=False):
    """Health check — no [missing: data.X] in full-data view output."""
    all_ok = True
    for view in views:
        if view in MINIMAL_VIEWS:
            print(f'  SKIP   L1  [{view}] minimal TestData')
            continue
        html = cache.get(view, '')
        if not html:
            print(f'  FAIL   L1  [{view}] no stitch output')
            all_ok = False
            continue
        missing = re.findall(r'\[missing: ([^\]]+)\]', html)
        if missing:
            print(f'  FAIL   L1  [{view}] {len(missing)} unresolved tag(s):')
            for m in sorted(set(missing)):
                print(f'               data.{m}')
            all_ok = False
        else:
            print(f'  OK     L1  [{view}] no unresolved tags')
    return all_ok


# ---------------------------------------------------------------------------
# Layer 2
# ---------------------------------------------------------------------------

def run_layer2(views, cache, verbose=False):
    """Structural spot checks — values inside correct HTML elements."""
    all_ok = True
    for label, view, pattern in SPOT_CHECKS:
        if view not in views:
            continue
        html = cache.get(view, '')
        ok = bool(re.search(pattern, html, re.DOTALL))
        tag = 'OK  ' if ok else 'FAIL'
        print(f'  {tag}   L2  [{view}] {label}')
        if not ok:
            all_ok = False
            if verbose:
                print(f'               pattern: {pattern}')
    return all_ok


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        prog='validate.py',
        description=(
            'Three-layer validation of stitched Office Day Tracker output.\n\n'
            'Layer 1 — Health:    no [missing: data.X] placeholders in output.\n'
            'Layer 2 — Structure: key TestData values land in correct HTML slots.\n'
            'Layer 3 — Schema:    inlined DATA fields have the right types/shapes.'
        ),
        epilog=(
            'Views:   Office, Home, Weekend, Logged (full data)\n'
            '         Fatal, Unauth (minimal data - Layers 1 & 3 skipped)\n\n'
            'Exit:    0 = all checks passed   1 = one or more checks failed\n\n'
            'Tip: run stitch.py --data Office first to regenerate previews,\n'
            '     then validate.py to check them - or just run validate.py\n'
            '     and it calls stitch automatically.'
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        '--view',
        choices=ALL_VIEWS,
        metavar='VIEW',
        help=f'Validate only one view. Choices: {", ".join(ALL_VIEWS)}.',
    )
    parser.add_argument(
        '--layer',
        choices=['1', '2', '3'],
        metavar='N',
        help='Run only one layer: 1 (health), 2 (spot checks), 3 (schema). Default: all.',
    )
    parser.add_argument(
        '--verbose', action='store_true',
        help='On failure show unresolved tag names and failing regex patterns.',
    )
    args = parser.parse_args()

    views = [args.view] if args.view else ALL_VIEWS
    run_l1 = args.layer in (None, '1')
    run_l2 = args.layer in (None, '2')
    run_l3 = args.layer in (None, '3')

    print(f'Running stitch for: {", ".join(views)} ...')
    cache = _build_cache(views)
    print()

    all_ok = True

    if run_l1:
        print('--- Layer 1: health checks ---')
        all_ok = run_layer1(views, cache, verbose=args.verbose) and all_ok
        print()

    if run_l2:
        print('--- Layer 2: structural spot checks ---')
        all_ok = run_layer2(views, cache, verbose=args.verbose) and all_ok
        print()

    if run_l3:
        print('--- Layer 3: DATA schema checks ---')
        all_ok = run_layer3(views, cache, verbose=args.verbose) and all_ok
        print()

    print('All checks passed.' if all_ok else 'Checks failed — review above.')
    sys.exit(0 if all_ok else 1)


if __name__ == '__main__':
    main()
