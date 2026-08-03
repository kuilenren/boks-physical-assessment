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
  permission: {
    "scope.camera": {
      desc: "用于拍摄孩子四视角体态观察照片，仅用于本次体态任务，不存储原始照片。",
    },
    "scope.writePhotosAlbum": {
      desc: "用于从相册选择体态观察照片，仅用于本次体态任务。",
    },
  },
  requiredPrivateInfos: [
    "chooseAddress",
  ],
  networkTimeout: {
    request: 15000,
    connectSocket: 10000,
    uploadFile: 30000,
    downloadFile: 30000,
  },
});
