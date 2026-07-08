import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiRoot = path.resolve(__dirname, "../..");
const uploadDir = path.join(apiRoot, "uploads", "questions");
const maxBytes = 5 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

function readRequestBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("FILE_TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipartImage(buffer, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary) {
    return { error: "上传格式无效" };
  }

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const firstBoundary = buffer.indexOf(boundaryBuffer);
  if (firstBoundary === -1) {
    return { error: "上传内容无效" };
  }

  const headerStart = firstBoundary + boundaryBuffer.length + 2;
  const headerEnd = buffer.indexOf(Buffer.from("\r\n\r\n"), headerStart);
  if (headerEnd === -1) {
    return { error: "上传头信息无效" };
  }

  const header = buffer.slice(headerStart, headerEnd).toString("utf8");
  if (!/name="image"/i.test(header)) {
    return { error: "图片字段名必须为 image" };
  }

  const contentTypeMatch = header.match(/Content-Type:\s*([^\r\n]+)/i);
  const mimeType = contentTypeMatch?.[1]?.trim().toLowerCase();
  if (!allowedTypes.has(mimeType)) {
    return { error: "只支持 jpg、png 或 webp 图片" };
  }

  const fileStart = headerEnd + 4;
  const nextBoundary = buffer.indexOf(Buffer.from(`\r\n--${boundary}`), fileStart);
  if (nextBoundary === -1) {
    return { error: "上传文件无效" };
  }

  const file = buffer.slice(fileStart, nextBoundary);
  if (!file.length) {
    return { error: "图片不能为空" };
  }

  return { file, mimeType };
}

export function registerUploadRoutes(app) {
  app.post("/api/uploads/images", requireAuth, async (req, res) => {
    try {
      const contentType = req.get("content-type") || "";
      if (!contentType.startsWith("multipart/form-data")) {
        return res.status(400).json({ error: "请使用 multipart/form-data 上传图片" });
      }

      const buffer = await readRequestBuffer(req);
      const parsed = parseMultipartImage(buffer, contentType);
      if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
      }

      await fs.mkdir(uploadDir, { recursive: true });
      const filename = `${crypto.randomUUID()}${allowedTypes.get(parsed.mimeType)}`;
      const absolutePath = path.join(uploadDir, filename);
      await fs.writeFile(absolutePath, parsed.file);

      return res.status(201).json({
        imageUrl: `/uploads/questions/${filename}`
      });
    } catch (err) {
      if (err.message === "FILE_TOO_LARGE") {
        return res.status(400).json({ error: "图片不能超过 5MB" });
      }
      return res.status(500).json({ error: "图片上传失败" });
    }
  });
}
