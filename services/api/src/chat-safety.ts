import type { ChatCitation } from "@boks/contracts";

const redFlagPatterns: Array<{
  label: string;
  pattern: RegExp;
  advice: string;
}> = [
  {
    label: "emergency",
    pattern:
      /呼吸困难|不能呼吸|喘不上气|窒息|晕厥|昏迷|抽搐|急症|急救|失去意识/i,
    advice: "这是需要立即医疗处理的情况，请拨打当地急救电话或前往最近医院。",
  },
  {
    label: "severe_weakness",
    pattern: /明显无力|不能站立|下肢无力|肢体麻木|麻木|刺痛|发麻/i,
    advice: "无力和麻木可能提示神经或循环问题，请不要自行判断，尽快就医。",
  },
  {
    label: "persistent_pain",
    pattern: /夜间疼痛|夜间痛|静息痛|持续疼痛|反复疼痛|疼痛/i,
    advice: "夜间或静息状态下仍持续疼痛，需要专业查体，请预约专业人员评估。",
  },
  {
    label: "acute_pain",
    pattern: /急性疼痛|剧烈疼痛|剧痛|锐痛|刺痛|酸痛|胀痛/i,
    advice: "急性剧烈疼痛不应继续训练，请停止活动并咨询专业人员。",
  },
  {
    label: "injury",
    pattern: /外伤|骨折|扭伤|脱位|血肿|淤青|肿胀/i,
    advice: "外伤或疑似骨折请在固定和就医前避免活动，不要强行继续训练。",
  },
  {
    label: "diagnosis_request",
    pattern: /诊断|确诊|查体|Cobb|cobb角|脊柱侧弯/i,
    advice: "脊柱形态的诊断需要影像与专业查体，文字描述无法替代。",
  },
];

const refusalPrefix = "我不能根据文字或照片做诊断，也不能判断 Cobb 角。";
const refusalSuffix =
  "请立即停止训练；如有呼吸困难、急症或明显无力，请及时就医。" +
  "其他持续疼痛、麻木或夜间疼痛，请联系专业人员人工评估。";

export type SafetyDecision = {
  intercept: boolean;
  intent: string;
  reason: string;
};

export function classifySafety(content: string): SafetyDecision {
  const hit = redFlagPatterns.find((item) => item.pattern.test(content));
  if (hit)
    return {
      intercept: true,
      intent: "medical",
      reason: `检测到红旗：${hit.label}`,
    };
  return {
    intercept: false,
    intent: "process",
    reason: "普通流程类问题，可以回答。",
  };
}

export function refusalContent(content: string): string {
  const hit = redFlagPatterns.find((item) => item.pattern.test(content));
  return hit && hit.advice
    ? `${refusalPrefix}${hit.advice} ${refusalSuffix}`
    : `${refusalPrefix}${refusalSuffix}`;
}

export type ChatCitationInput = {
  source_id: string;
  title: string;
  version: string;
};

export function toChatCitations(
  items: Array<{ source_id: string; title: string; version: string }>,
): ChatCitation[] {
  return items.map((item) => ({
    source_id: item.source_id,
    title: item.title,
    version: item.version,
  }));
}
