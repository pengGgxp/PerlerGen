import { Palette } from "./types";
import { PERLER_COLORS } from "./beads/perler";
import { HAMA_COLORS } from "./beads/hama";
import { ARTKAL_S_COLORS } from "./beads/artkal";
import { GENERIC_291_COLORS } from "./beads/generic291";
import { PERLER_221_COLORS } from "./beads/perler221";
import { MARD_221_COLORS } from "./beads/mard";

// Re-export colors and utils
export { PERLER_COLORS } from "./beads/perler";
export { HAMA_COLORS } from "./beads/hama";
export { ARTKAL_S_COLORS } from "./beads/artkal";
export { GENERIC_291_COLORS } from "./beads/generic291";
export { PERLER_221_COLORS } from "./beads/perler221";
export { MARD_221_COLORS } from "./beads/mard";
export { hexToRgb, getColorDistance } from "./beads/utils";

export const AVAILABLE_PALETTES: Palette[] = [
  {
    id: "mard_221",
    name: "Mard Beads (221 Colors) / M豆221色",
    colors: MARD_221_COLORS,
  },
  //下面的部分是由于一开始不懂，添加的一些全网搜索到的色卡，不适用，所以注释掉
  // {
  //   id: "perler",
  //   name: "Perler (Standard 60+) / 拼拼豆豆",
  //   colors: PERLER_COLORS,
  // },
  // {
  //   id: "artkal",
  //   name: "Artkal (Full S-Series) / 硬豆S系列",
  //   colors: ARTKAL_S_COLORS,
  // },
  // {
  //   id: "generic_291",
  //   name: "Generic 291 (Series A-Z) / 通用291色 (A-Z系列)",
  //   colors: GENERIC_291_COLORS,
  // },
  // {
  //   id: "perler_221",
  //   name: "Perler (221 Colors) / 拼豆221色",
  //   colors: PERLER_221_COLORS,
  // },
  // { id: "hama", name: "Hama Beads / 哈马珠", colors: HAMA_COLORS },
];

// Compatibility export
export const BEAD_PALETTE = PERLER_COLORS;
