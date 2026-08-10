"""安全策略：红旗检测、意图分类、强制拒答模板。

设计约束：
- AI 服务是健康教育工具，不提供诊断、不输出数值幻觉。
- 涉及疼痛、麻木、无力、夜间疼痛、呼吸困难、急症、Cobb 角等一律拦截。
- 拦截时必须给可执行的下一步，而不是假装无风险。
"""

import re

from .models import IntentDecision

RED_FLAG_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "emergency",
        re.compile(r"呼吸困难|不能呼吸|喘不上气|窒息|晕厥|昏迷|抽搐|急症|急救|窒息|失去意识"),
    ),
    ("severe_weakness", re.compile(r"明显无力|不能站立|下肢无力|肢体麻木|麻木|刺痛|发麻")),
    ("persistent_pain", re.compile(r"夜间疼痛|夜间痛|静息痛|持续疼痛|反复疼痛|疼痛")),
    ("acute_pain", re.compile(r"急性疼痛|剧烈疼痛|剧痛|锐痛|刺痛|酸痛|胀痛")),
    ("injury", re.compile(r"外伤|骨折|扭伤|脱位|血肿|淤青|肿胀")),
    ("diagnosis_request", re.compile(r"诊断|确诊|查体|Cobb|cobb角|脊柱侧弯")),
]

# 允许回答的意图域：非诊断性、流程/行为类问题。
ALLOWED_INTENT_HINTS: list[tuple[str, re.Pattern[str]]] = [
    (
        "process",
        re.compile(
            r"怎么|如何|流程|步骤|要求|标准|规则|政策|隐私|删除|导出|照片|拍摄|报告|评分|查询|登录|账号|测试|体测|跳绳|仰卧起坐|肺活量|BMI|训练|锻炼|计划|打卡|目标"
        ),
    ),
]

REFUSAL_PREFIX = "我不能根据文字或照片做诊断，也不能判断 Cobb 角。"

REFUSAL_SUFFIX = (
    "请立即停止训练；如有呼吸困难、急症或明显无力，请及时就医。"
    "其他持续疼痛、麻木或夜间疼痛，请联系专业人员人工评估。"
)

# 每种红旗下对应的额外提醒，让拒答不是机械复读。
RED_FLAG_ADVICE: dict[str, str] = {
    "emergency": "这是需要立即医疗处理的情况，请拨打当地急救电话或前往最近医院。",
    "severe_weakness": "无力和麻木可能提示神经或循环问题，请不要自行判断，尽快就医。",
    "persistent_pain": "夜间或静息状态下仍持续疼痛，需要专业查体，请预约专业人员评估。",
    "acute_pain": "急性剧烈疼痛不应继续训练，请停止活动并咨询专业人员。",
    "injury": "外伤或疑似骨折请在固定和就医前避免活动，不要强行继续训练。",
    "diagnosis_request": "脊柱形态的诊断需要影像与专业查体，文字描述无法替代。",
}


def classify(content: str) -> IntentDecision:
    """对输入做红旗检测与意图分类，返回是否拦截及原因。"""
    hits = [
        (label, pattern.search(content))
        for label, pattern in RED_FLAG_PATTERNS
        if pattern.search(content)
    ]
    if hits:
        labels = [label for label, _ in hits]
        return IntentDecision(
            intercept=True,
            intent="medical",
            reason=f"检测到红旗：{', '.join(labels)}",
        )
    hints = [label for label, pattern in ALLOWED_INTENT_HINTS if pattern.search(content)]
    if hints:
        return IntentDecision(
            intercept=False,
            intent=hints[0],
            reason="普通流程类问题，可以回答。",
        )
    return IntentDecision(
        intercept=False,
        intent="unknown",
        reason="无法可靠归类，按保守策略给出通用答复。",
    )


def refusal_content(content: str) -> str:
    """生成拒绝回答的内容，包含红旗对应的具体下一步。"""
    advice = ""
    for label, pattern in RED_FLAG_PATTERNS:
        if pattern.search(content):
            advice = RED_FLAG_ADVICE.get(label, "")
            break
    if advice:
        return f"{REFUSAL_PREFIX}{advice} {REFUSAL_SUFFIX}"
    return f"{REFUSAL_PREFIX}{REFUSAL_SUFFIX}"
