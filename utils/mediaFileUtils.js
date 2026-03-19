const fs = require("fs");
const path = require("path");

const MIME_TO_EXT = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "text/plain": ".txt",
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const downloadRemoteFileToTemp = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type") || "";

  let ext = path.extname(new URL(url).pathname || "").toLowerCase();
  if (!ext) {
    ext = MIME_TO_EXT[contentType.split(";")[0].trim().toLowerCase()] || ".pdf";
  }

  const tempDir = path.join(__dirname, "..", "tmp", "remote-files");
  ensureDir(tempDir);

  const fileName = `remote-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const tempPath = path.join(tempDir, fileName);
  fs.writeFileSync(tempPath, buffer);
  return tempPath;
};

const resolveStoredFileForParsing = async (storedUrl = "") => {
  if (!storedUrl || typeof storedUrl !== "string") {
    return { filePath: "", cleanup: null };
  }

  if (/^https?:\/\//i.test(storedUrl)) {
    const filePath = await downloadRemoteFileToTemp(storedUrl);
    return {
      filePath,
      cleanup: () => {
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (_error) {}
      },
    };
  }

  if (storedUrl.startsWith("/uploads/")) {
    const relativePath = storedUrl.replace(/^\//, "");
    const filePath = path.join(__dirname, "..", "public", relativePath);
    return { filePath, cleanup: null };
  }

  return { filePath: storedUrl, cleanup: null };
};

module.exports = {
  resolveStoredFileForParsing,
};

