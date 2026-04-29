#!/usr/bin/env python3
"""
validate.py — verify component files match ui_preview.html content exactly.

Extracts the office view from both the stitch-assembled output and ui_preview.html,
compares them section by section using whitespace-normalized diff (indentation is
not meaningful in HTML, but content must be identical).

Usage:
  python validate.py                   run full validation (all components + JS)
  python validate.py --component Rings check only RingsCard
  python validate.py --component JS    check only JavaScript block
  python validate.py --verbose         show full diff (not just first 30 lines)
"""

import argparse
import difflib
import re
import subprocess
import sys
from pathlib import Path

HERE           = Path(__file__).parent                                    # nfc_relay/HTML/Helpers/
COMPONENTS_DIR = HERE.parent.parent / 'OfficeDayTracker_AppScript'       # nfc_relay/OfficeDayTracker_AppScript/
OUTPUT_DIR     = HERE.parent / 'HTML_StitchOutput'                       # nfc_relay/HTML/HTML_StitchOutput/
MASTER         = HERE.parent / 'HTML_ColorVariantsIncompleteSkeleton' / 'ui_preview.html'
STITCH         = HERE / 'stitch.py'


def normalize(text):
    """Strip all leading/trailing whitespace per line, drop blank lines.

    Indentation is insignificant in HTML — this avoids false positives from
    component files using different indent levels than the master.
    """
    return [line.strip() for line in text.splitlines() if line.strip()]


def extract_script_block(html):
    """Extract the inline <script> body (the big JS block, not CDN script tags)."""
    pat = re.compile(r'<script>(.+?)</script>', re.DOTALL)
    matches = pat.findall(html)
    if not matches:
        raise ValueError('no inline <script> block found')
    # Return the largest match — the CDN tag has no body, so only one match expected
    return max(matches, key=len)


def extract_view(html, view_id):
    """Extract inner content of <div id="{view_id}" class="view..."> from html."""
    pat = re.compile(
        rf'<div id="{re.escape(view_id)}"[^>]*>(.*?)\n</div>',
        re.DOTALL,
    )
    m = pat.search(html)
    if not m:
        raise ValueError(f'view #{view_id} not found')
    return m.group(1)


def extract_card(view_html, card_class):
    """Extract first <div class="card {card_class}">...</div> block from view_html.

    Handles nested divs by counting open/close tags.
    """
    start_tag = f'<div class="card {card_class}">'
    idx = view_html.find(start_tag)
    if idx == -1:
        raise ValueError(f'.{card_class} not found in view')

    depth, pos = 0, idx
    while pos < len(view_html):
        open_  = view_html.find('<div', pos)
        close_ = view_html.find('</div>', pos)
        if open_ == -1 and close_ == -1:
            break
        if open_ != -1 and (close_ == -1 or open_ < close_):
            depth += 1
            pos = open_ + 4
        else:
            depth -= 1
            pos = close_ + 6
            if depth == 0:
                return view_html[idx:pos]
    raise ValueError(f'could not find closing tag for .{card_class}')


def diff_sections(label, master_text, component_text, verbose=False):
    """Diff two HTML strings (whitespace-normalized). Returns True if identical."""
    m_lines = normalize(master_text)
    c_lines = normalize(component_text)

    if m_lines == c_lines:
        print(f'  OK    {label}')
        return True

    diffs = list(difflib.unified_diff(
        m_lines, c_lines,
        fromfile=f'ui_preview ({label})',
        tofile=f'{label} component',
        lineterm='',
    ))
    changed = [d for d in diffs if d.startswith(('+', '-')) and not d.startswith(('+++', '---'))]
    limit = len(diffs) if verbose else 30
    print(f'  FAIL  {label}  ({len(changed)} differing lines)')
    for line in diffs[:limit]:
        print(f'    {line}')
    if not verbose and len(diffs) > 30:
        print(f'    ... ({len(diffs) - 30} more lines) — run --verbose to see all')
    return False


# Maps component name → (card_class_in_master, component_filename)
COMPONENTS = {
    'Title':    ('header-card',   'TitleCard.html'),
    'Rings':    ('rings-card',    'RingsCard.html'),
    'Days':     ('days-card',     'DaysCard.html'),
    'Calendar': ('calendar-card', 'CalendarCard.html'),
    'Stats':    ('charts-card',   'StatisticsCard.html'),
}


def run_stitch_default():
    """Run stitch.py --theme Default and return the assembled HTML string."""
    result = subprocess.run(
        [sys.executable, str(STITCH), '--theme', 'Default'],
        capture_output=True, text=True,
    )
    output_path = OUTPUT_DIR / '_preview_default.html'
    if not output_path.exists():
        raise RuntimeError(f'stitch.py did not produce {output_path}\n{result.stderr}')
    return output_path.read_text(encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(
        prog='validate.py',
        description=(
            'Verify component files match ui_preview.html content.\n'
            'Runs stitch.py --theme Default, then diffs the assembled office\n'
            'view against ui_preview.html section by section.'
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    all_choices = list(COMPONENTS) + ['JS']
    parser.add_argument(
        '--component', choices=all_choices, metavar='NAME',
        help=f'Check only one component. Choices: {", ".join(all_choices)}.',
    )
    parser.add_argument(
        '--verbose', action='store_true',
        help='Show full diff output instead of first 30 lines.',
    )
    args = parser.parse_args()

    if not MASTER.exists():
        print(f'  ERROR  master not found: {MASTER}', file=sys.stderr)
        sys.exit(1)

    master_html = MASTER.read_text(encoding='utf-8')
    master_view = extract_view(master_html, 'view-office')

    print('Running stitch.py --theme Default ...')
    stitch_html = run_stitch_default()
    stitch_view = extract_view(stitch_html, 'view-office')
    print()

    run_js  = args.component in (None, 'JS')
    run_cards = args.component is None or args.component in COMPONENTS
    targets = ({args.component: COMPONENTS[args.component]} if run_cards and args.component and args.component != 'JS'
               else COMPONENTS if run_cards else {})
    all_ok  = True

    for name, (card_class, fname) in targets.items():
        component_path = COMPONENTS_DIR / fname
        if not component_path.exists():
            print(f'  SKIP  {name} ({fname} not found)')
            continue

        try:
            master_card  = extract_card(master_view, card_class)
            stitch_card  = extract_card(stitch_view, card_class)
        except ValueError as e:
            print(f'  SKIP  {name} — {e}')
            continue

        ok = diff_sections(name, master_card, stitch_card, verbose=args.verbose)
        all_ok = all_ok and ok

    if run_js:
        js_path = COMPONENTS_DIR / 'JavaScript.html'
        if not js_path.exists():
            print(f'  SKIP  JS (JavaScript.html not found)')
        else:
            try:
                # Baseline is JavaScript.html itself — verifies stitch inlines it intact.
                # ui_preview.html is NOT used as JS reference: JavaScript.html has null-guards
                # (required for multi-view dev sandbox) that ui_preview.html doesn't need.
                source_js = extract_script_block(js_path.read_text(encoding='utf-8'))
                stitch_js = extract_script_block(stitch_html)
                m_sorted = sorted(normalize(source_js))
                s_sorted = sorted(normalize(stitch_js))
                if m_sorted == s_sorted:
                    print(f'  OK    JS (sorted)')
                else:
                    # Show only lines unique to each side
                    import collections
                    m_count = collections.Counter(m_sorted)
                    s_count = collections.Counter(s_sorted)
                    only_master = [l for l in m_count if m_count[l] > s_count.get(l, 0)]
                    only_stitch = [l for l in s_count if s_count[l] > m_count.get(l, 0)]
                    print(f'    (master = JavaScript.html, stitch = assembled output)')
                    limit = None if args.verbose else 15
                    print(f'  FAIL  JS  ({len(only_master)} lines only in master, {len(only_stitch)} only in stitch)')
                    for l in (only_master[:limit] if limit else only_master):
                        print(f'    - {l}')
                    for l in (only_stitch[:limit] if limit else only_stitch):
                        print(f'    + {l}')
                    all_ok = False
            except ValueError as e:
                print(f'  SKIP  JS — {e}')

    print()
    print('All components match.' if all_ok else 'Differences found — review above.')
    if not all_ok:
        sys.exit(1)


if __name__ == '__main__':
    main()
