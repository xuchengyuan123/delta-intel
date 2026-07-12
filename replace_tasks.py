import json
import re

path = r"C:\Users\徐承远\Desktop\三角洲情报台-上传包\docs\data.json"

with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

data = json.loads(text)

# 生成任务项
items = []

# 第一阶段：昨日再临
phase1_main = ["蜕变之初", "恢复训练", "生存收集", "幽灵频段", "石棺之下", "困兽", "乌姆河之家"]
phase1_sub1 = ["深度定制-1", "深度定制-2", "深度定制-3", "深度定制-4", "深度定制-5"]
phase1_sub2 = ["夜幕中的老鼠", "洗消车危机", "生死时速", "亦敌亦友", "谎言与真心"]
phase1_sub3 = ["战略转进-1", "战略转进-2", "战略转进-3", "战略转进-4", "战略转进-5"]
phase1_sub4 = ["保障有力·配件", "保障有力·防护", "保障有力·医疗", "保障有力·火力", "保障有力·磐石"]

for i, t in enumerate(phase1_main, 1):
    items.append({"id": f"m{i}", "title": t, "content": "第一阶段·赛季主线：昨日再临", "done": False, "open": False})
for i, t in enumerate(phase1_sub1, len(items)+1):
    items.append({"id": f"m{i}", "title": t, "content": "第一阶段·赛季支线：深度定制", "done": False, "open": False})
for i, t in enumerate(phase1_sub2, len(items)+1):
    items.append({"id": f"m{i}", "title": t, "content": "第一阶段·赛季支线：夜幕中的老鼠", "done": False, "open": False})
for i, t in enumerate(phase1_sub3, len(items)+1):
    items.append({"id": f"m{i}", "title": t, "content": "第一阶段·赛季支线：战略转进", "done": False, "open": False})
for i, t in enumerate(phase1_sub4, len(items)+1):
    items.append({"id": f"m{i}", "title": t, "content": "第一阶段·赛季支线：保障有力", "done": False, "open": False})

# 第二阶段：分裂的真相
phase2_main = ["数据洪流", "混乱诗篇", "沸点", "辐射初探", "恐惧", "链式反应", "对弈", "守夜人"]
phase2_sub1 = ["统治力", "锋线前卫", "抵近射击", "咬紧牙关", "观光客"]
phase2_sub2 = ["阿萨拉飞行员-1", "阿萨拉飞行员-2", "阿萨拉飞行员-3", "阿萨拉飞行员-4", "阿萨拉飞行员-5"]
phase2_sub3 = ["石与花-1", "石与花-2", "石与花-3", "石与花-4", "石与花-5"]
phase2_sub4 = ["搜索与歼灭-1", "搜索与歼灭-2", "搜索与歼灭-3", "搜索与歼灭-4", "搜索与歼灭-5"]
phase2_sub5 = ["控制与保障-1", "控制与保障-2", "控制与保障-3", "控制与保障-4", "控制与保障-5"]
phase2_sub6 = ["博物强识-1", "博物强识-2", "博物强识-3", "博物强识-4", "博物强识-5"]
phase2_sub7 = ["清道夫-1", "清道夫-2", "清道夫-3", "清道夫-4", "清道夫-5"]

for t in phase2_main:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第二阶段·赛季主线：分裂的真相", "done": False, "open": False})
for t in phase2_sub1:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第二阶段·赛季支线：战斗专家", "done": False, "open": False})
for t in phase2_sub2:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第二阶段·赛季支线：阿萨拉飞行员", "done": False, "open": False})
for t in phase2_sub3:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第二阶段·赛季支线：石与花", "done": False, "open": False})
for t in phase2_sub4:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第二阶段·赛季支线：搜索与歼灭", "done": False, "open": False})
for t in phase2_sub5:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第二阶段·赛季支线：控制与保障", "done": False, "open": False})
for t in phase2_sub6:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第二阶段·赛季支线：博物强识", "done": False, "open": False})
for t in phase2_sub7:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第二阶段·赛季支线：清道夫", "done": False, "open": False})

# 第三阶段：聚变无声
phase3_main = ["脑机校准", "中子风暴", "审判", "暗流", "凡人之躯", "雨中泪", "绝地标杆", "第三次求救"]
phase3_sub1 = ["金枪客-1", "金枪客-2", "金枪客-3", "金枪客-4", "金枪客-5", "金枪客-6", "金枪客-7"]
phase3_sub2 = ["狙击精英-1", "狙击精英-2", "狙击精英-3", "狙击精英-4", "狙击精英-5"]
phase3_sub3 = ["红区", "英雄遗孀", "铁幕之后", "幸存者", "辐射余波"]
phase3_sub4 = ["区域猎手·行动开始", "区域猎手·AZ3", "区域猎手·巴别塔", "区域猎手·中心区"]
phase3_sub5 = ["我心永恒", "核电站遇袭", "三方会晤"]
phase3_sub6 = ["逃脱艺术·自掏腰包", "逃脱艺术·金蝉脱壳", "逃脱艺术·接力棒", "逃脱艺术·大干一票", "逃脱艺术·唯我独尊"]
phase3_sub7 = ["精致人生-1", "精致人生-2", "精致人生-3", "精致人生-4", "精致人生-5"]
phase3_sub8 = ["拾荒者-1", "拾荒者-2", "拾荒者-3", "拾荒者-4", "拾荒者-5"]

for t in phase3_main:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第三阶段·赛季主线：聚变无声", "done": False, "open": False})
for t in phase3_sub1:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第三阶段·赛季支线：战斗专家·金枪客", "done": False, "open": False})
for t in phase3_sub2:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第三阶段·赛季支线：战斗专家·狙击精英", "done": False, "open": False})
for t in phase3_sub3:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第三阶段·赛季支线：红区", "done": False, "open": False})
for t in phase3_sub4:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第三阶段·赛季支线：区域猎手", "done": False, "open": False})
for t in phase3_sub5:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第三阶段·赛季支线：我心永恒", "done": False, "open": False})
for t in phase3_sub6:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第三阶段·赛季支线：逃脱艺术", "done": False, "open": False})
for t in phase3_sub7:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第三阶段·赛季支线：精致人生", "done": False, "open": False})
for t in phase3_sub8:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第三阶段·赛季支线：拾荒者", "done": False, "open": False})

# 第四阶段：心聚变
phase4_main = ["突入禁区", "猫鼠游戏", "加速进化", "人工干预", "决战前夕", "相变如初"]
for t in phase4_main:
    items.append({"id": f"m{len(items)+1}", "title": t, "content": "第四阶段·赛季主线：心聚变", "done": False, "open": False})

# 收集者委托
collectors = [
    ("灵眼 3/7 弹道计算狙击镜 ×1", "特勤处·技术中心"),
    ("5.8x42mm DVC12 子弹 ×1", "特勤处·工作台"),
    ("6.8x51mm HYBRID 子弹 ×2", "特勤处·工作台"),
    ("精密护甲维修包 ×1", "特勤处·制药台"),
    ("战地医疗箱 ×2", "特勤处·制药台"),
    ("高级护甲维修组合 ×3", "特勤处·制药台"),
    ("重型突击背心 ×1", "特勤处·防具台"),
    ("黑鹰野战胸挂 ×2", "特勤处·防具台"),
    ("加密路由器 ×2", "电子/情报"),
    ("电子干扰器 ×3", "电子/情报"),
    ("Wednesday 手机 ×1", "电子/情报"),
    ("微型燃料棒 ×1", "能源/燃料"),
    ("便携燃料瓶 ×1", "能源/燃料"),
    ("军事通行证 ×1", "其他物资"),
    ("输液加温器 ×1", "其他物资"),
]
collector_items = []
for i, (title, content) in enumerate(collectors, 1):
    collector_items.append({"id": f"c{i}", "title": title, "content": content, "done": False, "open": False})

# 命运契约
fate = ["征服标杆", "异尘余生", "擒贼擒王·新变量", "勤俭持家", "南征北战", "观光客·沉默锋芒", "终局联系"]
fate_items = []
for i, t in enumerate(fate, 1):
    fate_items.append({"id": f"f{i}", "title": t, "content": "完成 2 项解锁 3×3 安全箱（炫彩外观需 7 项全完成）", "done": False, "open": False})

# 组装
new_tasks = {
    "season": "S10 裂变",
    "updated": "2026-07-12",
    "search": "",
    "note": "S10「裂变」赛季（2026-06-26 开启）。3×3 任务分四大阶段主线 + 星级支线 + 收集者委托 + 命运契约。数据来自 ali213/7724/18183 等多家攻略站交叉核对，以游戏内实际为准。",
    "source": "S10 任务体系来自 youxiabc.com、ali213.net、7724.com、18183.com 等攻略站交叉核对；命运契约按周逐步解锁。",
    "groups": [
        {"id": "g_main", "name": "赛季主线任务", "cls": "col-main", "open": True, "items": items},
        {"id": "g_collector", "name": "收集者委托", "cls": "col-collector", "open": True, "items": collector_items},
        {"id": "g_fate", "name": "命运契约", "cls": "col-fate", "open": True, "items": fate_items}
    ]
}

data["tasks"] = new_tasks

# 确保 guides 存在且格式正确
if "guides" not in data:
    data["guides"] = {"intro": "", "modules": []}

# 写入
with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Tasks replaced:", len(items), "main/sub", len(collector_items), "collector", len(fate_items), "fate")
