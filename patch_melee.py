import json

with open('docs/data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for m in data.get('melee', []):
    # 保留原有字段，补充数值面板字段；不编造数值，空值表示待管理员填写
    m.setdefault('dmgStages', '')
    m.setdefault('armorDmg', '')
    m.setdefault('penLevel', '')
    m.setdefault('headshot', '')
    m.setdefault('runSpeed', '')
    m.setdefault('walkSpeed', '')
    m.setdefault('attackSpeed', '')
    m.setdefault('range', '')
    m.setdefault('desc', m.get('note', ''))

with open('docs/data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print('melee fields patched:', len(data.get('melee', [])))
