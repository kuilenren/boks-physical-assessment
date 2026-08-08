import Taro from "@tarojs/taro";
import { request } from "./http";
import type { PreSignedUpload } from "../models";

/**
 * 创建上传会话，获取预签名 URL
 */
export async function createUploadSession(
  childId: string,
  fileType: string,
  fileSize: number,
  purpose: "photo" | "video",
): Promise<PreSignedUpload> {
  const resp = await request<PreSignedUpload>(
    "/media/upload-sessions",
    {
      method: "POST",
      data: {
        child_id: childId,
        file_type: fileType,
        file_size: fileSize,
        purpose,
      },
    },
  );
  return resp;
}

/**
 * 完成上传（通知服务端验证）
 */
export async function completeUpload(sessionId: string): Promise<void> {
  await request(`/media/upload-sessions/${sessionId}/complete`, {
    method: "POST",
  });
}

/**
 * 上传单张图片，返回最终 key
 */
export async function uploadPhoto(
  childId: string,
  tempFilePath: string,
  purpose: "pre-assessment" | "post-assessment",
): Promise<string> {
  const fileExt = tempFilePath.split(".").pop()?.toLowerCase() ?? "jpg";
  const fileHandle = Taro.getFileSystemManager().accessSync(tempFilePath);
  const fileSize = Taro.getFileSystemManager().statSync(tempFilePath).size;

  const session = await createUploadSession(childId, `image/${fileExt}`, fileSize, "photo");

  const uploadResult = await Taro.uploadFile({
    url: session.presigned_url,
    filePath: tempFilePath,
    name: "file",
  });

  if (uploadResult.statusCode !== 200) {
    throw new Error(`上传失败：${uploadResult.statusCode}`);
  }

  await completeUpload(session.id);
  return session.key;
}