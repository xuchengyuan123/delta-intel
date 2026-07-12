import json, re
from pathlib import Path

p = Path(r'C:\Users\徐承远\Desktop\三角洲情报台-上传包\docs\data.json')
with open(p, 'r', encoding='utf-8') as f:
    data = json.load(f)

# 1. 更新活动物品需求（来源：KK日报 2026-07-11 快照）
data['eventItems'] = {
    "title": "活动物品需求（研发部门·集市）",
    "period": "2026/07/10 - 2026/07/17",
    "api": "",
    "note": "管理员在后台维护活动物品名称后，前台会自动调用免费实时价格接口（caiweilv/DeltaForcePrice）匹配当前交易行价格；若实时源中无该物品，则显示理想售价。",
    "items": [
        {"name": "9V电池", "ideal": 14872, "cur": 40548},
        {"name": "摩卡咖啡壶", "ideal": 86419, "cur": 200119}
    ]
}

# 2. 更新音乐列表：只保留已确认 QQ音乐 songid 的曲目，确保音乐台默认就能播放
# 已确认 songid：Into the Never (归) 563352993（来自官方荣耀社区公开链接）
# 其他歌曲没有公开 songid 时，先不放到首页音乐台，避免显示“尚未配置”
data['music'] = [
    {
        "title": "Into the Never (归)",
        "artist": "三角洲行动 / LUMi",
        "type": "qq",
        "songid": "563352993",
        "dur": "03:57",
        "tag": "黑鹰坠落片尾曲",
        "cover": ""
    },
    {
        "title": "DeltaForce (Main Theme)",
        "artist": "Zio",
        "type": "qq",
        "songid": "",
        "dur": "03:05",
        "tag": "主题曲",
        "cover": ""
    },
    {
        "title": "星河追梦 (Beyond the Stars)",
        "artist": "三角洲行动 / 黄宗辉",
        "type": "qq",
        "songid": "",
        "dur": "03:36",
        "tag": "威龙凌霄戍卫皮肤主题曲",
        "cover": ""
    }
]

with open(p, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print('data.json updated: eventItems + music')
