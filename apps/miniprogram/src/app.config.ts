export default defineAppConfig({
  pages: [
    "pages/home/index",
    "pages/family/index",
    "pages/assessment/start",
    "pages/assessment/input",
    "pages/report/list",
    "pages/report/detail",
    "pages/training/detail",
    "pages/posture/consent",
    "pages/posture/capture",
    "pages/privacy/index",
  ],
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#F7FBF6",
    navigationBarTitleText: "BOKS",
    navigationBarTextStyle: "black",
  },
  tabBar: {
    color: "#4C6258",
    selectedColor: "#2E8B57",
    backgroundColor: "#FFFFFF",
    borderStyle: "white",
    list: [
      {
        pagePath: "pages/home/index",
        text: "首页",
      },
      {
        pagePath: "pages/assessment/start",
        text: "体测",
      },
      {
        pagePath: "pages/training/detail",
        text: "训练",
      },
      {
        pagePath: "pages/family/index",
        text: "我的",
      },
    ],
  },
});
