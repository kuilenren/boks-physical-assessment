import { randomUUID } from "node:crypto";
import {
  updatePlatformStore,
  type KnowledgeSource,
  type KnowledgeVersion,
} from "./demo-store.js";
import { contentHash } from "./knowledge-sync.js";

const REVIEWERS = ["reviewer-one", "reviewer-two"];

type SeedSource = {
  id: string;
  title: string;
  owner: string;
  fetch_url: string | null;
  version: string;
  content: string;
};

const SEED_SOURCES: SeedSource[] = [
  {
    id: "src-national-2014-standard",
    title: "《国家学生体质健康标准（2014年修订）》项目与评分说明",
    owner: "中华人民共和国教育部",
    fetch_url: "https://www.moe.gov.cn/",
    version: "2014修订",
    content:
      "《国家学生体质健康标准（2014年修订）》规定小学至大学体质测试项目：小学一、二年级测体重指数（BMI）、肺活量、50米跑、坐位体前屈、1分钟跳绳；三、四年级增加1分钟仰卧起坐；五、六年级增加50米×8往返跑；初中及以上增加立定跳远、引体向上（男）/1分钟仰卧起坐（女）、1000米（男）/800米（女）跑。总评分为100分制，附加分另计；学生按年级对应评分表计分，缺测项目按0分处理。BOKS 平台按此标准内置评分表，用于儿童体测成绩计算与报告生成。",
  },
  {
    id: "src-training-safety",
    title: "儿童体测训练安全与停止条件",
    owner: "BOKS 内容团队",
    fetch_url: null,
    version: "1.0",
    content:
      "儿童参与体测或体能训练前应确认身体健康状况，存在急性伤病、发热或医嘱静养时应暂停训练。训练中出现胸痛、头晕、恶心、面色苍白、关节疼痛或麻木等症状，应立即停止并休息，必要时就医。训练强度应循序渐进，训练前后做好热身与放松，保证充足睡眠与水分。BOKS 生成的训练计划仅作健康教育参考，不替代医疗诊断，涉及疼痛、麻木等不适请停止训练并咨询专业人员。",
  },
  {
    id: "src-posture-protocol",
    title: "儿童体态评估四视角拍摄流程",
    owner: "BOKS 内容团队",
    fetch_url: null,
    version: "1.0",
    content:
      "BOKS 体态评估需要拍摄儿童正面、背面、左侧、右侧四个视角的站立全身照片。拍摄要求：儿童自然站立，双脚与肩同宽，双臂自然下垂，穿贴身浅色衣物，背景简洁光线均匀，相机与儿童视线高度一致，取景包含全身。照片仅用于体态对称性等健康教育分析，不用于医疗诊断，不能据此判断 Cobb 角。照片上传后仅监护人可查看，存储受隐私保护控制。",
  },
  {
    id: "src-privacy-control",
    title: "BOKS 数据与隐私控制",
    owner: "BOKS 内容团队",
    fetch_url: null,
    version: "1.0",
    content:
      "BOKS 平台遵循最小必要原则收集儿童体测与体态数据。所有体测记录、体态照片、训练计划仅对授权的监护人账户可见。监护人可随时申请删除儿童数据（含导出与删除请求），平台支持账号注销与数据删除。体态照片只用于健康教育分析，不上传给任何第三方用于商业用途。知情同意记录可追溯，涉及儿童隐私的操作均记录审计日志。",
  },
];

export function seedPublishedKnowledge(): {
  seeded_sources: number;
  seeded_versions: number;
} {
  let seededSources = 0;
  let seededVersions = 0;
  updatePlatformStore((platform) => {
    for (const seed of SEED_SOURCES) {
      if (platform.knowledgeSources[seed.id]) continue;
      const source: KnowledgeSource = {
        id: seed.id,
        title: seed.title,
        owner: seed.owner,
        fetch_url: seed.fetch_url,
        content_hash: contentHash(seed.content),
        created_at: new Date().toISOString(),
      };
      const version: KnowledgeVersion = {
        id: randomUUID(),
        source_id: seed.id,
        version: seed.version,
        title: seed.title,
        content: seed.content,
        content_hash: contentHash(seed.content),
        status: "published",
        reviewers: [...REVIEWERS],
        published_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      platform.knowledgeSources[seed.id] = source;
      platform.knowledgeVersions[version.id] = version;
      seededSources += 1;
      seededVersions += 1;
    }
  });
  return { seeded_sources: seededSources, seeded_versions: seededVersions };
}
