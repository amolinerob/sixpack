import json
import re
from pathlib import Path

import pandas as pd

root = Path(__file__).resolve().parents[1]
excel_path = root / 'Six_Pack_Base_Alimentos_v1.xlsx'
output_dir = root / 'src' / 'data'
output_dir.mkdir(parents=True, exist_ok=True)

df = pd.read_excel(excel_path)
records = []

for index, row in df.iterrows():
    name = str(row['Nombre']).strip()
    brand = str(row['Marca']).strip()
    serving = str(row['Ración habitual']).strip()
    kcal = float(row['Kcal/100 g'])
    protein = float(row['Proteínas/100 g (g)'])
    carbs = float(row['Hidratos/100 g (g)'])
    fat = float(row['Grasas/100 g (g)'])

    unit = None
    grams = None
    serving_text = serving

    normalized = serving.replace(',', '.')
    unit_match = re.search(r'([0-9][0-9,\.]*)(?:\s*)(g|ml|kg|cl)', normalized, flags=re.I)
    if unit_match:
        value = float(unit_match.group(1).replace(',', '.'))
        unit = unit_match.group(2).lower()
        if unit == 'g':
            grams = value

    if unit is None:
        g_match = re.search(r'([0-9][0-9,\.]*)\s*g', serving, flags=re.I)
        if g_match:
            unit = 'g'
            grams = float(g_match.group(1).replace(',', '.'))
        elif 'ml' in serving.lower():
            unit = 'ml'
        elif 'kg' in serving.lower():
            unit = 'kg'

    records.append({
        'id': f'alimento-{index + 1:03d}',
        'name': name,
        'brand': brand,
        'servingHabitual': serving_text,
        'servingUnit': unit,
        'servingGrams': grams,
        'kcal100g': kcal,
        'protein100g': protein,
        'carbs100g': carbs,
        'fat100g': fat,
    })

food_type = '''export type FoodItem = {
  id: string
  name: string
  brand: string
  servingHabitual: string
  servingUnit: string | null
  servingGrams: number | null
  kcal100g: number
  protein100g: number
  carbs100g: number
  fat100g: number
}

export const foods: FoodItem[] = '''

(output_dir / 'foods.ts').write_text(food_type + json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(output_dir / 'foods.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')

print(f'Created {len(records)} food records from {excel_path.name}')
print(f'Output: {output_dir / "foods.ts"}')
