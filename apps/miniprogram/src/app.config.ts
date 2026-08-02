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
    "pages/posture/report",
    "pages/chat/index",
    "pages/privacy/index",
  ],
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#103E2F",
    navigationBarTitleText: "BOKS智能体测体态分析",
    navigationBarTextStyle: "white",
  },
  tabBar: {
    color: "#5B7168",
    selectedColor: "#1F6E45",
    backgroundColor: "#FFFFFF",
    borderStyle: "white",
    list: [
      {
        pagePath: "pages/home/index",
        text: "首页",
        iconPath: "assets/tab/home.png",
        selectedIconPath: "assets/tab/home-active.png",
      },
      {
        pagePath: "pages/assessment/start",
        text: "体测",
        iconPath: "assets/tab/assessment.png",
        selectedIconPath: "assets/tab/assessment-active.png",
      },
      {
        pagePath: "pages/training/detail",
        text: "训练",
        iconPath: "assets/tab/training.png",
        selectedIconPath: "assets/tab/training-active.png",
      },
      {
        pagePath: "pages/family/index",
        text: "我的",
        iconPath: "assets/tab/family.png",
        selectedIconPath: "assets/tab/family-active.png",
      },
    ],
  },
});
