const fs = require("fs");
const path = require("path");

// This is a mapping object coverts mime type into file extension.
const MIME_TO_EXT = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "text/plain": ".txt",
};

// ensures a folder exists to save the resumes, it creates if not 
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// it takes a file url, downloads the file, save it temporarily on our server, and reutrns the local path. 
const downloadRemoteFileToTemp = async (url) => {
  // this sends a request to the URL and downloads the response
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
  }

  // Donwnloaded file data comes as raw binary data
  const arrayBuffer = await response.arrayBuffer(); // reads the binary content
  const buffer = Buffer.from(arrayBuffer);// converts it into Node.js buffer
  // A buffer is the format node uses for binary file data
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

