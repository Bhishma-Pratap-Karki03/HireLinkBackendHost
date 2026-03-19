const fs = require("fs"); // Node built-in: read files from disk (resumes)
const path = require("path"); // Node built-in: safely build file paths and read file extensions
const { pathToFileURL } = require("url"); // Converts a local path into a file:// URL (used for pdf font path)
const { PDFParse } = require("pdf-parse"); // PDF text extractor (your code uses a class-style API)
const mammoth = require("mammoth"); // DOCX text extractor
const skillDictionary = require("./atsSkills"); // Base list of skills to detect
const skillAliases = require("./atsSkillAliases"); // Canonical skill names + their variant spellings

const normalize = (value) => String(value || "").toLowerCase(); // Make any value lowercase string; null/undefined becomes ""

const normalizeText = (value) =>
  normalize(value) // Lowercase first
    .replace(/[^a-z0-9+#.]/g, " ") // Replace everything except letters/numbers/+/#/. with spaces (keeps c++, c#, node.js)
    .replace(/\s+/g, " ") // Collapse multiple spaces into one
    .trim(); // Remove leading/trailing spaces

const ensureString = (value) =>
  typeof value === "string" ? value : String(value || ""); // Ensure regex always receives a string

const extractEmails = (text) => {
  const matches = ensureString(text).match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g, // Basic email pattern matcher
  );
  return Array.from(new Set(matches || [])); // Return unique emails
};

const extractPhones = (text) => {
  const matches = ensureString(text).match(/(\+?\d[\d\s\-()]{7,}\d)/g); // Find phone-like sequences (supports +, spaces, dashes, brackets)
  const cleaned = (matches || []).map((value) => value.trim()); // Trim each match
  const filtered = cleaned.filter((value) => {
    const normalized = value.replace(/\s+/g, ""); // Remove spaces for simpler validation
    if (/^\d{4}[-–]\d{4}$/.test(normalized)) return false; // Exclude patterns like 1234-5678 (often not phone)
    if (/^\d{4}$/.test(normalized)) return false; // Exclude 4-digit numbers (often years/IDs)
    if (/--/.test(value)) return false; // Exclude weird double-dash sequences
    return true; // Keep everything else
  });
  return Array.from(new Set(filtered)); // Return unique phone numbers
};

const extractExperienceYears = (text) => {
  const source = ensureString(text); // Work with a guaranteed string

  const explicitMatches = source.match(/(\d+)\s*(years|year|yrs|yr)\b/gi); // Match "5 years", "3 yr", etc.
  const explicitValues = (explicitMatches || [])
    .map((item) => parseInt(item, 10)) // Extract the numeric part
    .filter((num) => !Number.isNaN(num)); // Remove invalid parses

  if (explicitValues.length) {
    return Math.max(...explicitValues); // If resume states years explicitly, return the largest mentioned number
  }

  const yearMatches =
    source.match(/(19|20)\d{2}\s*[-–]\s*(present|current|(19|20)\d{2})/gi) ||
    []; // Match "2018 - 2022" or "2020 - Present"
  const currentYear = new Date().getFullYear(); // Used for "present/current"

  const rangeValues = yearMatches.map((match) => {
    const parts = match.split(/[-–]/).map((part) => part.trim().toLowerCase()); // Split "start - end" and normalize
    const start = parseInt(parts[0], 10); // Start year
    const endPart = parts[1] || ""; // End year or "present/current"
    const end = /present|current/.test(endPart)
      ? currentYear // Replace present/current with current year
      : parseInt(endPart, 10); // Otherwise parse the end year

    if (Number.isNaN(start) || Number.isNaN(end)) return 0; // If parsing fails, treat as 0
    return Math.max(0, end - start); // Duration in years (never negative)
  });

  const maxRange = rangeValues.length ? Math.max(...rangeValues) : 0; // Take the biggest single range found
  return maxRange; // Return estimated experience years
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // Escape regex special chars (important for terms like c++)

const normalizedAliasMap = new Map(); // Maps each variant -> canonical skill
const variantsByCanonical = new Map(); // Maps canonical skill -> list of all normalized variants

skillAliases.forEach((entry) => {
  const canonical = normalizeText(entry.canonical); // Normalize the canonical skill key

  const variants = Array.from(
    new Set(
      [entry.canonical, ...(entry.variants || [])] // Include canonical itself + all variants
        .map((item) => normalizeText(item)) // Normalize each variant
        .filter(Boolean), // Drop empty strings
    ),
  );

  if (!variants.length) return; // If nothing valid, skip

  variantsByCanonical.set(canonical, variants); // Store canonical -> variants list

  variants.forEach((variant) => {
    normalizedAliasMap.set(variant, canonical); // Store each variant -> canonical mapping
  });
});

const hasTermInText = (normalizedText, term) => {
  if (!normalizedText || !term) return false; // Safety check
  const regex = new RegExp(`(?:^|\\s)${escapeRegex(term)}(?:\\s|$)`); // Match whole term boundaries via whitespace
  return regex.test(normalizedText); // True if the term exists as a separate word/phrase
};

const canonicalizeSkill = (skill) => {
  const normalized = normalizeText(skill); // Normalize incoming skill text
  if (!normalized) return ""; // Empty becomes empty
  if (normalizedAliasMap.has(normalized))
    return normalizedAliasMap.get(normalized); // If it is a known variant, return canonical
  return normalized; // Otherwise return normalized original
};

const extractSkills = (text, dictionary = skillDictionary) => {
  const normalizedText = normalizeText(text); // Normalize resume text once
  const matches = new Set(); // Use a Set to prevent duplicates

  dictionary.forEach((skill) => {
    const canonical = canonicalizeSkill(skill); // Normalize/canonicalize dictionary skill
    if (!canonical) return; // Skip empty entries
    const variants = variantsByCanonical.get(canonical) || [canonical]; // Get variants if known, else only canonical
    const matched = variants.some(
      (variant) => hasTermInText(normalizedText, variant), // Check if any variant exists in resume
    );
    if (matched) {
      matches.add(canonical); // Store canonical skill if found
    }
  });

  skillAliases.forEach((entry) => {
    const canonical = canonicalizeSkill(entry.canonical); // Canonicalize alias entry
    const variants = variantsByCanonical.get(canonical) || [canonical]; // Variants list
    const matched = variants.some(
      (variant) => hasTermInText(normalizedText, variant), // Check presence in resume
    );
    if (matched) {
      matches.add(canonical); // Add canonical skill to results
    }
  });

  return Array.from(matches); // Convert Set to array of skills
};

const educationLevels = [
  { label: "Doctorate", rank: 5, terms: ["phd", "doctorate", "dphil"] }, // Highest level terms
  {
    label: "Master",
    rank: 4,
    terms: ["master", "msc", "m.sc", "mba", "m.a", "m.s"], // Master-level terms
  },
  {
    label: "Bachelor",
    rank: 3,
    terms: [
      "bachelor",
      "bsc",
      "b.sc",
      "be",
      "b.e",
      "ba",
      "b.a",
      "btech",
      "bsc(hons)",
      "bsc (hons)",
      "bsc. (hons)",
    ], // Bachelor-level terms
  },
  {
    label: "Associate",
    rank: 2,
    terms: ["associate", "diploma", "advanced diploma"], // Associate/diploma terms
  },
  {
    label: "High School",
    rank: 1,
    terms: ["high school", "secondary", "slc", "10+2", "plus two"], // High school terms
  },
];

const extractEducationLevel = (text) => {
  const normalizedText = ` ${normalizeText(text)} `; // Add spaces around whole text to support " includes ' term ' " checks
  let best = { label: "", rank: 0 }; // Best match found so far

  for (const level of educationLevels) {
    const hit = level.terms.some(
      (term) => normalizedText.includes(` ${normalizeText(term)} `), // Check if any term exists as whole word/phrase
    );
    if (hit && level.rank > best.rank) {
      best = { label: level.label, rank: level.rank }; // Keep highest education rank found
    }
  }
  return best; // Returns {label, rank}
};

const parseResumeText = async (resumePath) => {
  const ext = path.extname(resumePath).toLowerCase(); // Determine file extension
  const buffer = fs.readFileSync(resumePath); // Read full resume file as bytes

  if (ext === ".pdf") {
    const standardFontsPath = path.join(
      __dirname,
      "..",
      "node_modules",
      "pdfjs-dist",
      "standard_fonts",
    ); // Path to pdfjs standard fonts (helps pdf text extraction render correctly)
    const standardFontsUrl = `${pathToFileURL(standardFontsPath).href}/`; // Convert fonts folder path to file:// URL
    const parser = new PDFParse({
      data: new Uint8Array(buffer), // PDF content as Uint8Array
      standardFontDataUrl: standardFontsUrl, // Tell parser where fonts are
    });

    await parser.load(); // Load PDF document
    const textResult = await parser.getText(); // Extract text

    if (textResult && typeof textResult.text === "string") {
      return textResult.text; // If parser returns object with .text, return that
    }
    return textResult || ""; // Otherwise return whatever result is, fallback to empty string
  }

  if (ext === ".docx") {
    const { value } = await mammoth.extractRawText({ buffer }); // Extract raw text from DOCX
    return value || ""; // Return extracted text or empty
  }

  return buffer.toString("utf8"); // For txt or unknown formats, treat as utf8 string
};

module.exports = {
  parseResumeText, // Reads resume file and returns plain text
  extractEmails, // Extract unique emails from text
  extractPhones, // Extract unique phone numbers from text
  extractExperienceYears, // Estimate years of experience
  extractSkills, // Extract canonical skills from resume text
  extractEducationLevel, // Extract highest education level found
  canonicalizeSkill, // Convert any skill variant to canonical form
  normalizeText, // Normalize text for consistent matching
  normalize, // Basic lowercase normalization
  ensureString, // Safe string conversion helper
};
