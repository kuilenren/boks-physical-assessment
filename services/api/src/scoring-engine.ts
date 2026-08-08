import type { AssessmentIndicator, AssessmentValue, Child } from "@boks/contracts";

export const NATIONAL_2014_STANDARD_ID = "std-national-primary-2014-v1";
export const NATIONAL_2014_STANDARD_NAME =
  "国家学生体质健康标准（2014年修订）";
export const NATIONAL_2014_ALGORITHM_VERSION = "national-2014-table-1.0";
export const NATIONAL_2014_SOURCE_URL =
  "https://www.gov.cn/gongbao/content/2014/content_2781929.htm";

export type Direction = "higher_is_better" | "lower_is_better";

export type BandTable = {
  direction: Direction;
  points: Array<{ score: number; threshold: number }>;
  bonus?: { baseScore: number; step: number; maxBonus: number };
};

type BandTableBySex = Record<"male" | "female", BandTable>;
type BandTablesByGrade = Record<string, BandTableBySex>;

const scoreLevels = [100, 95, 90, 85, 80, 78, 76, 74, 72, 70, 68, 66, 64, 62, 60, 50, 40, 30, 20, 10];

function table(
  direction: Direction,
  male: number[],
  female: number[],
): BandTableBySex {
  return {
    male: { direction, points: zip(scoreLevels, male) },
    female: { direction, points: zip(scoreLevels, female) },
  };
}

function tableWithBonus(
  direction: Direction,
  male: number[],
  female: number[],
  baseScore: number,
  step: number,
  maxBonus: number,
): BandTableBySex {
  return {
    male: {
      direction,
      points: zip(scoreLevels, male),
      bonus: { baseScore, step, maxBonus },
    },
    female: {
      direction,
      points: zip(scoreLevels, female),
      bonus: { baseScore, step, maxBonus },
    },
  };
}

function zip(scores: number[], thresholds: number[]) {
  return scores.map((score, index) => ({ score, threshold: thresholds[index] }));
}

const run50mTables: BandTablesByGrade = {
  "1": table("lower_is_better", [10.2, 10.3, 10.4, 10.5, 10.6, 10.8, 11.0, 11.2, 11.4, 11.6, 11.8, 12.0, 12.2, 12.4, 12.6, 12.8, 13.0, 13.2, 13.4, 13.6], [11.0, 11.1, 11.2, 11.5, 11.8, 12.0, 12.2, 12.4, 12.6, 12.8, 13.0, 13.2, 13.4, 13.6, 13.8, 14.0, 14.2, 14.4, 14.6, 14.8]),
  "2": table("lower_is_better", [9.6, 9.7, 9.8, 9.9, 10.0, 10.2, 10.4, 10.6, 10.8, 11.0, 11.2, 11.4, 11.6, 11.8, 12.0, 12.2, 12.4, 12.6, 12.8, 13.0], [10.0, 10.1, 10.2, 10.5, 10.8, 11.0, 11.2, 11.4, 11.6, 11.8, 12.0, 12.2, 12.4, 12.6, 12.8, 13.0, 13.2, 13.4, 13.6, 13.8]),
  "3": table("lower_is_better", [9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 9.9, 10.1, 10.3, 10.5, 10.7, 10.9, 11.1, 11.3, 11.5, 11.7, 11.9, 12.1, 12.3, 12.5], [9.2, 9.3, 9.4, 9.7, 10.0, 10.2, 10.4, 10.6, 10.8, 11.0, 11.2, 11.4, 11.6, 11.8, 12.0, 12.2, 12.4, 12.6, 12.8, 13.0]),
  "4": table("lower_is_better", [8.7, 8.8, 8.9, 9.0, 9.1, 9.3, 9.5, 9.7, 9.9, 10.1, 10.3, 10.5, 10.7, 10.9, 11.1, 11.3, 11.5, 11.7, 11.9, 12.1], [8.7, 8.8, 8.9, 9.2, 9.5, 9.7, 9.9, 10.1, 10.3, 10.5, 10.7, 10.9, 11.1, 11.3, 11.5, 11.7, 11.9, 12.1, 12.3, 12.5]),
  "5": table("lower_is_better", [8.4, 8.5, 8.6, 8.7, 8.8, 9.0, 9.2, 9.4, 9.6, 9.8, 10.0, 10.2, 10.4, 10.6, 10.8, 11.0, 11.2, 11.4, 11.6, 11.8], [8.3, 8.4, 8.5, 8.8, 9.1, 9.3, 9.5, 9.7, 9.9, 10.1, 10.3, 10.5, 10.7, 10.9, 11.1, 11.3, 11.5, 11.7, 11.9, 12.1]),
  "6": table("lower_is_better", [8.2, 8.3, 8.4, 8.5, 8.6, 8.8, 9.0, 9.2, 9.4, 9.6, 9.8, 10.0, 10.2, 10.4, 10.6, 10.8, 11.0, 11.2, 11.4, 11.6], [8.2, 8.3, 8.4, 8.7, 9.0, 9.2, 9.4, 9.6, 9.8, 10.0, 10.2, 10.4, 10.6, 10.8, 11.0, 11.2, 11.4, 11.6, 11.8, 12.0]),
};

const sitReachTables: BandTablesByGrade = {
  "1": table("higher_is_better", [16.1, 14.6, 13.0, 12.0, 11.0, 9.9, 8.8, 7.7, 6.6, 5.5, 4.4, 3.3, 2.2, 1.1, 0.0, -0.8, -1.6, -2.4, -3.2, -4.0], [18.6, 17.3, 16.0, 14.7, 13.4, 12.3, 11.2, 10.1, 9.0, 7.9, 6.8, 5.7, 4.6, 3.5, 2.4, 1.6, 0.8, 0.0, -0.8, -1.6]),
  "2": table("higher_is_better", [16.2, 14.7, 13.2, 11.9, 10.6, 9.5, 8.4, 7.3, 6.2, 5.1, 4.0, 2.9, 1.8, 0.7, -0.4, -1.2, -2.0, -2.8, -3.6, -4.4], [18.9, 17.6, 16.3, 14.8, 13.3, 12.2, 11.1, 10.0, 8.9, 7.8, 6.7, 5.6, 4.5, 3.4, 2.3, 1.5, 0.7, -0.1, -0.9, -1.7]),
  "3": table("higher_is_better", [16.3, 14.9, 13.4, 11.8, 10.2, 9.1, 8.0, 6.9, 5.8, 4.7, 3.6, 2.5, 1.4, 0.3, -0.8, -1.6, -2.4, -3.2, -4.0, -4.8], [19.2, 17.9, 16.6, 14.9, 13.2, 12.1, 11.0, 9.9, 8.8, 7.7, 6.6, 5.5, 4.4, 3.3, 2.2, 1.4, 0.6, -0.2, -1.0, -1.8]),
  "4": table("higher_is_better", [16.4, 15.0, 13.6, 11.7, 9.8, 8.6, 7.4, 6.2, 5.0, 3.8, 2.6, 1.4, 0.2, -1.0, -2.2, -3.2, -4.2, -5.2, -6.2, -7.2], [19.5, 18.1, 16.9, 15.0, 13.1, 12.0, 10.9, 9.8, 8.7, 7.6, 6.5, 5.4, 4.3, 3.2, 2.1, 1.3, 0.5, -0.3, -1.1, -1.9]),
  "5": table("higher_is_better", [16.5, 15.2, 13.8, 11.6, 9.4, 8.2, 7.0, 5.8, 4.6, 3.4, 2.2, 1.0, -0.2, -1.4, -2.6, -3.6, -4.6, -5.6, -6.6, -7.6], [19.8, 18.5, 17.2, 15.1, 13.0, 11.9, 10.8, 9.7, 8.6, 7.5, 6.4, 5.3, 4.2, 3.1, 2.0, 1.2, 0.4, -0.4, -1.2, -2.0]),
  "6": table("higher_is_better", [16.6, 15.3, 14.0, 11.5, 9.0, 7.7, 6.4, 5.1, 3.8, 2.5, 1.2, -0.1, -1.4, -2.7, -4.0, -5.0, -6.0, -7.0, -8.0, -9.0], [19.9, 18.7, 17.5, 15.2, 12.9, 11.8, 10.7, 9.6, 8.5, 7.4, 6.3, 5.2, 4.1, 3.0, 1.9, 1.1, 0.3, -0.5, -1.3, -2.1]),
};

const rope1minTables: BandTablesByGrade = {
  "1": tableWithBonus("higher_is_better", [109, 104, 99, 93, 87, 80, 73, 66, 59, 52, 45, 38, 31, 24, 17, 14, 11, 8, 5, 2], [117, 110, 103, 95, 87, 80, 73, 66, 59, 52, 45, 38, 31, 24, 17, 14, 11, 8, 5, 2], 109, 2, 20),
  "2": tableWithBonus("higher_is_better", [117, 112, 107, 101, 95, 88, 81, 74, 67, 60, 53, 46, 39, 32, 25, 22, 19, 16, 13, 10], [127, 120, 113, 105, 97, 90, 83, 76, 69, 62, 55, 48, 41, 34, 27, 24, 21, 18, 15, 12], 117, 2, 20),
  "3": tableWithBonus("higher_is_better", [126, 121, 116, 110, 104, 97, 90, 83, 76, 69, 62, 55, 48, 41, 34, 31, 28, 25, 22, 19], [139, 132, 125, 117, 109, 102, 95, 88, 81, 74, 67, 60, 53, 46, 39, 36, 33, 30, 27, 24], 126, 2, 20),
  "4": tableWithBonus("higher_is_better", [137, 132, 127, 121, 115, 108, 101, 94, 87, 80, 73, 66, 59, 52, 45, 42, 39, 36, 33, 30], [149, 142, 135, 127, 119, 112, 105, 98, 91, 84, 77, 70, 63, 56, 49, 46, 43, 40, 37, 34], 137, 2, 20),
  "5": tableWithBonus("higher_is_better", [148, 143, 138, 132, 126, 119, 112, 105, 98, 91, 84, 77, 70, 63, 56, 53, 50, 47, 44, 41], [158, 151, 144, 136, 128, 121, 114, 107, 100, 93, 86, 79, 72, 65, 58, 55, 52, 49, 46, 43], 148, 2, 20),
  "6": tableWithBonus("higher_is_better", [157, 152, 147, 141, 135, 128, 121, 114, 107, 100, 93, 86, 79, 72, 65, 62, 59, 56, 53, 50], [166, 159, 152, 144, 136, 129, 122, 115, 108, 101, 94, 87, 80, 73, 66, 63, 60, 57, 54, 51], 157, 2, 20),
};

const lungCapacityTables: BandTablesByGrade = {
  "1": table("higher_is_better", [1700, 1600, 1500, 1400, 1300, 1240, 1180, 1120, 1060, 1000, 940, 880, 820, 760, 700, 660, 620, 580, 540, 500], [1400, 1300, 1200, 1100, 1000, 960, 920, 880, 840, 800, 760, 720, 680, 640, 600, 580, 560, 540, 520, 500]),
  "2": table("higher_is_better", [2000, 1900, 1800, 1650, 1500, 1430, 1360, 1290, 1220, 1150, 1080, 1010, 940, 870, 800, 750, 700, 650, 600, 550], [1600, 1500, 1400, 1300, 1200, 1150, 1100, 1050, 1000, 950, 900, 850, 800, 750, 700, 680, 660, 640, 620, 600]),
  "3": table("higher_is_better", [2300, 2200, 2100, 1900, 1700, 1620, 1540, 1460, 1380, 1300, 1220, 1140, 1060, 980, 900, 840, 780, 720, 660, 600], [1800, 1700, 1600, 1500, 1400, 1340, 1280, 1220, 1160, 1100, 1040, 980, 920, 860, 800, 780, 760, 740, 720, 700]),
  "4": table("higher_is_better", [2600, 2500, 2400, 2150, 1900, 1820, 1740, 1660, 1580, 1500, 1420, 1340, 1260, 1180, 1100, 1030, 960, 890, 820, 750], [2000, 1900, 1800, 1700, 1600, 1530, 1460, 1390, 1320, 1250, 1180, 1110, 1040, 970, 900, 880, 860, 840, 820, 800]),
  "5": table("higher_is_better", [2900, 2800, 2700, 2450, 2200, 2110, 2020, 1930, 1840, 1750, 1660, 1570, 1480, 1390, 1300, 1220, 1140, 1060, 980, 900], [2250, 2150, 2050, 1950, 1850, 1770, 1690, 1610, 1530, 1450, 1370, 1290, 1210, 1130, 1050, 1020, 990, 960, 930, 900]),
  "6": table("higher_is_better", [3200, 3100, 3000, 2750, 2500, 2400, 2300, 2200, 2100, 2000, 1900, 1800, 1700, 1600, 1500, 1410, 1320, 1230, 1140, 1050], [2500, 2400, 2300, 2200, 2100, 2010, 1920, 1830, 1740, 1650, 1560, 1470, 1380, 1290, 1200, 1170, 1140, 1110, 1080, 1050]),
};

const sitUpTables: BandTablesByGrade = {
  "3": table("higher_is_better", [48, 45, 42, 39, 36, 34, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6], [46, 44, 42, 39, 36, 34, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6]),
  "4": table("higher_is_better", [49, 46, 43, 40, 37, 35, 33, 31, 29, 27, 25, 23, 21, 19, 17, 15, 13, 11, 9, 7], [47, 45, 43, 40, 37, 35, 33, 31, 29, 27, 25, 23, 21, 19, 17, 15, 13, 11, 9, 7]),
  "5": table("higher_is_better", [50, 47, 44, 41, 38, 36, 34, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8], [48, 46, 44, 41, 38, 36, 34, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8]),
  "6": table("higher_is_better", [51, 48, 45, 42, 39, 37, 35, 33, 31, 29, 27, 25, 23, 21, 19, 17, 15, 13, 11, 9], [49, 47, 45, 42, 39, 37, 35, 33, 31, 29, 27, 25, 23, 21, 19, 17, 15, 13, 11, 9]),
};

const shuttle50x8Tables: BandTablesByGrade = {
  "5": table("lower_is_better", [96, 99, 102, 105, 108, 111, 114, 117, 120, 123, 126, 129, 132, 135, 138, 142, 146, 150, 154, 158], [101, 104, 107, 110, 113, 116, 119, 122, 125, 128, 131, 134, 137, 140, 143, 147, 151, 155, 159, 163]),
  "6": table("lower_is_better", [90, 93, 96, 99, 102, 105, 108, 111, 114, 117, 120, 123, 126, 129, 132, 136, 140, 144, 148, 152], [97, 100, 103, 106, 109, 112, 115, 118, 121, 124, 127, 130, 133, 136, 139, 143, 147, 151, 155, 159]),
};

export type BmiBand = { label: string; score: number; check: (value: number) => boolean };
type BmiBandsBySex = Record<"male" | "female", BmiBand[]>;

const bmiBands: Record<string, BmiBandsBySex> = {
  "1": {
    male: [
      { label: "肥胖", score: 60, check: (v) => v >= 20.4 },
      { label: "超重", score: 80, check: (v) => v >= 18.2 && v <= 20.3 },
      { label: "低体重", score: 80, check: (v) => v <= 13.4 },
      { label: "正常", score: 100, check: (v) => v >= 13.5 && v <= 18.1 },
    ],
    female: [
      { label: "肥胖", score: 60, check: (v) => v >= 19.3 },
      { label: "超重", score: 80, check: (v) => v >= 17.4 && v <= 19.2 },
      { label: "低体重", score: 80, check: (v) => v <= 13.2 },
      { label: "正常", score: 100, check: (v) => v >= 13.3 && v <= 17.3 },
    ],
  },
  "2": {
    male: [
      { label: "肥胖", score: 60, check: (v) => v >= 20.5 },
      { label: "超重", score: 80, check: (v) => v >= 18.5 && v <= 20.4 },
      { label: "低体重", score: 80, check: (v) => v <= 13.6 },
      { label: "正常", score: 100, check: (v) => v >= 13.7 && v <= 18.4 },
    ],
    female: [
      { label: "肥胖", score: 60, check: (v) => v >= 20.3 },
      { label: "超重", score: 80, check: (v) => v >= 17.9 && v <= 20.2 },
      { label: "低体重", score: 80, check: (v) => v <= 13.4 },
      { label: "正常", score: 100, check: (v) => v >= 13.5 && v <= 17.8 },
    ],
  },
  "3": {
    male: [
      { label: "肥胖", score: 60, check: (v) => v >= 22.2 },
      { label: "超重", score: 80, check: (v) => v >= 19.5 && v <= 22.1 },
      { label: "低体重", score: 80, check: (v) => v <= 13.8 },
      { label: "正常", score: 100, check: (v) => v >= 13.9 && v <= 19.4 },
    ],
    female: [
      { label: "肥胖", score: 60, check: (v) => v >= 21.2 },
      { label: "超重", score: 80, check: (v) => v >= 18.7 && v <= 21.1 },
      { label: "低体重", score: 80, check: (v) => v <= 13.5 },
      { label: "正常", score: 100, check: (v) => v >= 13.6 && v <= 18.6 },
    ],
  },
  "4": {
    male: [
      { label: "肥胖", score: 60, check: (v) => v >= 22.7 },
      { label: "超重", score: 80, check: (v) => v >= 20.2 && v <= 22.6 },
      { label: "低体重", score: 80, check: (v) => v <= 14.1 },
      { label: "正常", score: 100, check: (v) => v >= 14.2 && v <= 20.1 },
    ],
    female: [
      { label: "肥胖", score: 60, check: (v) => v >= 22.1 },
      { label: "超重", score: 80, check: (v) => v >= 19.5 && v <= 22.0 },
      { label: "低体重", score: 80, check: (v) => v <= 13.6 },
      { label: "正常", score: 100, check: (v) => v >= 13.7 && v <= 19.4 },
    ],
  },
  "5": {
    male: [
      { label: "肥胖", score: 60, check: (v) => v >= 24.2 },
      { label: "超重", score: 80, check: (v) => v >= 21.5 && v <= 24.1 },
      { label: "低体重", score: 80, check: (v) => v <= 14.3 },
      { label: "正常", score: 100, check: (v) => v >= 14.4 && v <= 21.4 },
    ],
    female: [
      { label: "肥胖", score: 60, check: (v) => v >= 23.0 },
      { label: "超重", score: 80, check: (v) => v >= 20.6 && v <= 22.9 },
      { label: "低体重", score: 80, check: (v) => v <= 13.7 },
      { label: "正常", score: 100, check: (v) => v >= 13.8 && v <= 20.5 },
    ],
  },
  "6": {
    male: [
      { label: "肥胖", score: 60, check: (v) => v >= 24.6 },
      { label: "超重", score: 80, check: (v) => v >= 21.9 && v <= 24.5 },
      { label: "低体重", score: 80, check: (v) => v <= 14.6 },
      { label: "正常", score: 100, check: (v) => v >= 14.7 && v <= 21.8 },
    ],
    female: [
      { label: "肥胖", score: 60, check: (v) => v >= 23.7 },
      { label: "超重", score: 80, check: (v) => v >= 20.9 && v <= 23.6 },
      { label: "低体重", score: 80, check: (v) => v <= 14.1 },
      { label: "正常", score: 100, check: (v) => v >= 14.2 && v <= 20.8 },
    ],
  },
};

export const gradeBandFor = (grade: number): "1" | "2" | "3" | "4" | "5" | "6" => {
  if (grade >= 1 && grade <= 6) return String(grade) as "1" | "2" | "3" | "4" | "5" | "6";
  throw new Error(`该标准仅支持小学一至六年级，当前为 ${grade} 年级。`);
};

export const weightsFor = (
  grade: number,
): Record<string, number> => {
  if (grade === 1 || grade === 2)
    return {
      bmi: 0.15,
      lung_capacity: 0.15,
      run_50m: 0.2,
      sit_reach: 0.3,
      rope_1min: 0.2,
    };
  if (grade === 3 || grade === 4)
    return {
      bmi: 0.15,
      lung_capacity: 0.15,
      run_50m: 0.2,
      sit_reach: 0.2,
      rope_1min: 0.2,
      sit_up: 0.1,
    };
  return {
    bmi: 0.15,
    lung_capacity: 0.15,
    run_50m: 0.2,
    sit_reach: 0.1,
    rope_1min: 0.1,
    sit_up: 0.2,
    shuttle_50x8: 0.1,
  };
};

export type National2014IndicatorDef = {
  indicator_code: string;
  label: string;
  unit: string;
  input_type: "decimal" | "integer";
  min_value: number;
  max_value: number;
  step: number;
  required: boolean;
  help_text: string;
  applies: (grade: number) => boolean;
  scoreType: "bmi" | "band";
};

const baseIndicators: Array<
  Omit<National2014IndicatorDef, "applies"> & {
    applies?: (grade: number) => boolean;
  }
> = [
  {
    indicator_code: "height",
    label: "身高",
    unit: "厘米",
    input_type: "decimal",
    min_value: 80,
    max_value: 220,
    step: 0.1,
    required: true,
    help_text: "脱鞋、站直，视线平行。",
    scoreType: "band",
  },
  {
    indicator_code: "weight",
    label: "体重",
    unit: "千克",
    input_type: "decimal",
    min_value: 10,
    max_value: 160,
    step: 0.1,
    required: true,
    help_text: "穿轻薄衣物测量。",
    scoreType: "band",
  },
  {
    indicator_code: "lung_capacity",
    label: "肺活量",
    unit: "毫升",
    input_type: "integer",
    min_value: 300,
    max_value: 8000,
    step: 1,
    required: true,
    help_text: "深吸后全力一次呼气总量。",
    scoreType: "band",
  },
  {
    indicator_code: "run_50m",
    label: "50 米跑",
    unit: "秒",
    input_type: "decimal",
    min_value: 5,
    max_value: 30,
    step: 0.1,
    required: true,
    help_text: "记录最好一次成绩，数值越小越好。",
    scoreType: "band",
  },
  {
    indicator_code: "sit_reach",
    label: "坐位体前屈",
    unit: "厘米",
    input_type: "decimal",
    min_value: -30,
    max_value: 60,
    step: 0.1,
    required: true,
    help_text: "双腿伸直，缓慢前伸。",
    scoreType: "band",
  },
  {
    indicator_code: "rope_1min",
    label: "一分钟跳绳",
    unit: "次",
    input_type: "integer",
    min_value: 0,
    max_value: 400,
    step: 1,
    required: true,
    help_text: "连续一分钟内有效次数，超过 100 分标准可获附加分。",
    scoreType: "band",
  },
  {
    indicator_code: "sit_up",
    label: "一分钟仰卧起坐",
    unit: "次",
    input_type: "integer",
    min_value: 0,
    max_value: 120,
    step: 1,
    required: true,
    help_text: "一分钟内完成的标准仰卧起坐次数。",
    scoreType: "band",
    applies: (grade) => grade >= 3,
  },
  {
    indicator_code: "shuttle_50x8",
    label: "50 米×8 往返跑",
    unit: "秒",
    input_type: "integer",
    min_value: 60,
    max_value: 300,
    step: 1,
    required: true,
    help_text: "往返跑总用时（秒），数值越小越好。",
    scoreType: "band",
    applies: (grade) => grade >= 5,
  },
];

export function national2014Indicators(grade: number): AssessmentIndicator[] {
  return baseIndicators
    .filter((indicator) => indicator.applies?.(grade) ?? true)
    .map((indicator) => ({
      indicator_code: indicator.indicator_code,
      label: indicator.label,
      unit: indicator.unit,
      input_type: indicator.input_type,
      min_value: indicator.min_value,
      max_value: indicator.max_value,
      step: indicator.step,
      required: indicator.required,
      help_text: indicator.help_text,
    }));
}

export function gradeOf(child: Child): number {
  const match = child.grade_code.match(/(\d+)/);
  if (!match) throw new Error(`无法从年级编码识别数字：${child.grade_code}`);
  return Number(match[1]);
}

export type BandScoreResult = {
  score: number | null;
  bonus: number;
  matched: { score: number; threshold: number } | null;
  band_label: string;
};

function scoreFromTable(
  tableValue: BandTable,
  value: number,
): BandScoreResult {
  const points = [...tableValue.points].sort((a, b) => b.score - a.score);
  let matched: { score: number; threshold: number } | null = null;
  for (const point of points) {
    const reached =
      tableValue.direction === "higher_is_better"
        ? value >= point.threshold
        : value <= point.threshold;
    if (reached) {
      matched = point;
      break;
    }
  }
  if (!matched) return { score: 0, bonus: 0, matched: null, band_label: "未达到最低分档" };
  let bonus = 0;
  if (tableValue.bonus && matched.score === 100) {
    const extra = tableValue.direction === "higher_is_better"
      ? value - tableValue.bonus.baseScore
      : tableValue.bonus.baseScore - value;
    if (extra > 0) {
      bonus = Math.min(
        tableValue.bonus.maxBonus,
        Math.floor(extra / tableValue.bonus.step),
      );
    }
  }
  return {
    score: matched.score,
    bonus,
    matched,
    band_label: `${matched.score} 分档`,
  };
}

export type ScoreInput = {
  child: Child;
  grade: number;
  values: AssessmentValue[];
};

export type EngineIndicatorScore = {
  indicator_code: string;
  score: number | null;
  bonus: number;
  contribution: number;
  weight: number;
  band_label: string;
  raw_value: string;
  interpretation: string;
  matched_threshold: number | null;
  status: "scored" | "missing" | "reference_only" | "needs_review";
};

export type EngineResult = {
  results: EngineIndicatorScore[];
  standard_score: number;
  bonus_score: number;
  total_score: number;
  level: "excellent" | "good" | "pass" | "fail";
  completeness: number;
};

function lookupBandTable(
  indicatorCode: string,
  grade: number,
): BandTableBySex | null {
  const tables: Record<string, BandTablesByGrade> = {
    run_50m: run50mTables,
    sit_reach: sitReachTables,
    rope_1min: rope1minTables,
    lung_capacity: lungCapacityTables,
    sit_up: sitUpTables,
    shuttle_50x8: shuttle50x8Tables,
  };
  return tables[indicatorCode]?.[gradeBandFor(grade)] ?? null;
}

function sexKey(sexCode: Child["sex_code"]): "male" | "female" {
  if (sexCode === "male" || sexCode === "female") return sexCode;
  throw new Error("该标准需要明确的性别（男/女）才能评分。");
}

function computeBmi(values: AssessmentValue[]): number | null {
  const height = values.find((item) => item.indicator_code === "height");
  const weight = values.find((item) => item.indicator_code === "weight");
  const heightMeters = height ? Number(height.raw_value) / 100 : NaN;
  const weightKg = weight ? Number(weight.raw_value) : NaN;
  if (!Number.isFinite(heightMeters) || heightMeters <= 0 || !Number.isFinite(weightKg))
    return null;
  return weightKg / (heightMeters * heightMeters);
}

function bmiResult(
  child: Child,
  grade: number,
  values: AssessmentValue[],
  weight: number,
): EngineIndicatorScore {
  const bmi = computeBmi(values);
  const raw =
    values.find((item) => item.indicator_code === "height")?.raw_value ?? "";
  if (bmi === null) {
    return {
      indicator_code: "bmi",
      score: null,
      bonus: 0,
      contribution: 0,
      weight,
      band_label: "",
      raw_value: "",
      interpretation: "缺少身高或体重，无法计算 BMI。",
      matched_threshold: null,
      status: "missing",
    };
  }
  const bands = bmiBands[gradeBandFor(grade)]?.[sexKey(child.sex_code)] ?? [];
  const hit = bands.find((band) => band.check(bmi)) ?? null;
  if (!hit) {
    return {
      indicator_code: "bmi",
      score: null,
      bonus: 0,
      contribution: 0,
      weight,
      band_label: "",
      raw_value: bmi.toFixed(1),
      interpretation: "BMI 超出已发布分档，需人工复核。",
      matched_threshold: null,
      status: "needs_review",
    };
  }
  return {
    indicator_code: "bmi",
    score: hit.score,
    bonus: 0,
    contribution: Number((hit.score * weight).toFixed(2)),
    weight,
    band_label: `${hit.label}（BMI ${bmi.toFixed(1)}）`,
    raw_value: bmi.toFixed(1),
    interpretation: `身体形态：${hit.label}。`,
    matched_threshold: null,
    status: "scored",
  };
}

export function scoreNational2014(input: ScoreInput): EngineResult {
  const { child, grade, values } = input;
  const weights = weightsFor(grade);
  const valueByCode = new Map(values.map((item) => [item.indicator_code, item]));
  const indicatorCodes = [
    "bmi",
    ...national2014Indicators(grade)
      .map((indicator) => indicator.indicator_code)
      .filter((code) => code !== "height" && code !== "weight"),
  ];

  const results: EngineIndicatorScore[] = indicatorCodes.map((code) => {
    const weight = weights[code] ?? 0;
    if (code === "bmi") return bmiResult(child, grade, values, weight);
    const submitted = valueByCode.get(code);
    const numeric = submitted ? Number(submitted.raw_value) : NaN;
    const valid = submitted !== undefined && Number.isFinite(numeric);
    if (!valid) {
      return {
        indicator_code: code,
        score: null,
        bonus: 0,
        contribution: 0,
        weight,
        band_label: "",
        raw_value: submitted?.raw_value ?? "",
        interpretation: "缺少实际测量值。",
        matched_threshold: null,
        status: "missing",
      };
    }
    const tableValue = lookupBandTable(code, grade)?.[sexKey(child.sex_code)] ?? null;
    if (!tableValue) {
      return {
        indicator_code: code,
        score: null,
        bonus: 0,
        contribution: 0,
        weight,
        band_label: "",
        raw_value: submitted.raw_value,
        interpretation: "该标准暂未提供此项目的评分表。",
        matched_threshold: null,
        status: "needs_review",
      };
    }
    const scored = scoreFromTable(tableValue, numeric);
    return {
      indicator_code: code,
      score: scored.score,
      bonus: scored.bonus,
      contribution: Number(((scored.score ?? 0) * weight).toFixed(2)),
      weight,
      band_label: scored.band_label,
      raw_value: submitted.raw_value,
      interpretation: buildInterpretation(code, numeric, scored.score),
      matched_threshold: scored.matched?.threshold ?? null,
      status: "scored",
    };
  });

  const requiredCodes = national2014Indicators(grade)
    .map((indicator) => indicator.indicator_code)
    .filter((code) => code !== "height" && code !== "weight");
  const requiredCount = requiredCodes.length;
  const completeness =
    requiredCount === 0
      ? 1
      : results.filter(
          (item) =>
            item.status === "scored" &&
            requiredCodes.includes(item.indicator_code),
        ).length / requiredCount;

  const standardScore = Number(
    results
      .reduce((sum, item) => sum + item.contribution, 0)
      .toFixed(1),
  );
  const bonusScore = Number(
    results.reduce((sum, item) => sum + item.bonus, 0).toFixed(1),
  );
  const totalScore = Number(
    (Math.min(120, standardScore + bonusScore)).toFixed(1),
  );
  const level =
    standardScore + bonusScore >= 90
      ? "excellent"
      : standardScore + bonusScore >= 80
        ? "good"
        : standardScore + bonusScore >= 60
          ? "pass"
          : "fail";

  return {
    results,
    standard_score: standardScore,
    bonus_score: bonusScore,
    total_score: totalScore,
    level,
    completeness,
  };
}

function buildInterpretation(
  code: string,
  value: number,
  score: number | null,
): string {
  if (score === null) return "请补充合法数据。";
  if (score >= 90) return "表现优秀，可继续保持当前练习节奏。";
  if (score >= 80) return "表现良好，建议维持并小幅提升。";
  if (score >= 60) return "处于及格区间，可作为下一阶段重点练习。";
  return "建议优先安排该项的基础训练。";
}
