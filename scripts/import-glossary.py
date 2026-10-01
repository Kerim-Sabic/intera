"""Read-only XLSX extraction of the owner's working glossary; no workbook edits."""
import argparse
import hashlib
import json
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('workbook', type=Path)
parser.add_argument('--output', type=Path, default=Path('src/shared/glossary-catalog.json'))
args = parser.parse_args()
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(args.workbook) as archive:
    shared = []
    if 'xl/sharedStrings.xml' in archive.namelist():
        shared = [''.join(e.itertext()) for e in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('m:si', ns)]

    def read_rows(sheet):
        rows = []
        for row in ET.fromstring(archive.read(f'xl/worksheets/sheet{sheet}.xml')).findall('.//m:sheetData/m:row', ns):
            cells = {}
            for cell in row.findall('m:c', ns):
                value = cell.find('m:v', ns)
                inline = cell.find('m:is', ns)
                text = value.text if value is not None else ''.join(inline.itertext()) if inline is not None else ''
                if cell.get('t') == 's':
                    text = shared[int(text)]
                cells[''.join(c for c in cell.get('r') if c.isalpha())] = text or ''
            rows.append(cells)
        return rows

    entries = []
    for sheet, direction, header in [(2, 'en-bs', 'English / source term'), (3, 'bs-en', 'Bosnian / lookup')]:
        rows = read_rows(sheet)
        if rows[3].get('A') != header:
            raise ValueError('Working index layout differs. Inspect before importing; original archives must not be used.')
        for index, row in enumerate(rows[4:], 5):
            if not row.get('A') or not row.get('B'):
                continue
            entries.append({'id': f'{direction}-{index}', 'direction': direction, 'source': row['A'], 'target': row['B'], 'notes': row.get('C', ''), 'alternatives': row.get('D', ''), 'category': row.get('E', '') or 'Other', 'status': row.get('G', ''), 'references': row.get('H', '')})
    data = {'name': 'Medical & insurance · supplied working glossary', 'sourceFile': args.workbook.name, 'sha256': hashlib.sha256(args.workbook.read_bytes()).hexdigest(), 'edition': 'Working edition 1.0, 30 September 2026', 'entries': entries}
    metadata = ',\n'.join(' '+json.dumps(key)+': '+json.dumps(value, ensure_ascii=False) for key, value in data.items() if key != 'entries')
    records = ',\n'.join('  '+json.dumps(entry, ensure_ascii=False) for entry in entries)
    args.output.write_text('{\n'+metadata+',\n "entries": [\n'+records+'\n ]\n}\n', encoding='utf-8')
    print(f'Imported {len(entries)} directional working entries; source workbook unchanged.')
