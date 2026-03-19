import re

# Canonical skill aliases used by both training and inference.
SKILL_ALIASES = {
    # Frontend / UI
    "html": {"html", "html5"},
    "css": {"css", "css3"},
    "javascript": {"javascript", "js", "ecmascript", "es6"},
    "typescript": {"typescript", "ts"},
    "react": {"react", "reactjs", "react.js"},
    "node.js": {"node", "nodejs", "node.js"},
    "next.js": {"next", "nextjs", "next.js"},
    "angular": {"angular", "angularjs"},
    "vue.js": {"vue", "vuejs", "vue.js"},
    "bootstrap": {"bootstrap", "bootstrap5", "bootstrap 5"},
    "tailwind css": {"tailwind", "tailwindcss", "tailwind css"},
    "figma": {"figma"},
    "wireframing": {"wireframe", "wireframing"},
    "prototyping": {"prototype", "prototyping"},
    "user research": {"user research", "ux research"},
    "rest api": {"rest", "rest api", "restful api", "rest api integration"},
    "ui/ux design": {
        "ui ux",
        "ui/ux",
        "ui-ux",
        "ui ux design",
        "ui/ux design",
        "ux ui design",
        "ui design",
        "ux design",
    },
    "responsive design": {"responsive", "responsive design"},
    "git": {"git", "github", "gitlab", "bitbucket"},

    # Backend / Databases / Cloud / DevOps
    "python": {"python", "python3"},
    "java": {"java", "core java"},
    "c#": {"c#", "c sharp", "dotnet", ".net", "asp.net", "asp net"},
    "php": {"php"},
    "laravel": {"laravel"},
    "spring boot": {"spring", "springboot", "spring boot"},
    "express.js": {"express", "expressjs", "express.js"},
    "mongodb": {"mongodb", "mongo", "mongo db"},
    "mysql": {"mysql", "my sql"},
    "postgresql": {"postgres", "postgresql", "postgre sql"},
    "sql server": {"sql server", "mssql", "ms sql"},
    "redis": {"redis"},
    "aws": {"aws", "amazon web services"},
    "azure": {"azure", "microsoft azure"},
    "google cloud": {"gcp", "google cloud", "google cloud platform"},
    "docker": {"docker"},
    "kubernetes": {"k8s", "kubernetes"},
    "ci/cd": {"ci cd", "ci/cd", "continuous integration", "continuous deployment"},
    "linux": {"linux", "ubuntu", "centos"},

    # Data / AI
    "excel": {"excel", "ms excel", "microsoft excel"},
    "power bi": {"powerbi", "power bi"},
    "tableau": {"tableau"},
    "machine learning": {"ml", "machine learning"},
    "deep learning": {"dl", "deep learning"},
    "nlp": {"nlp", "natural language processing"},
    "data analysis": {"data analysis", "analytics"},

    # QA / Security / Project
    "testing": {"testing", "software testing", "qa testing"},
    "selenium": {"selenium"},
    "cybersecurity": {"cyber security", "cybersecurity", "information security"},
    "agile": {"agile", "scrum", "kanban"},
    "jira": {"jira"},

    # Banking / Finance domain
    "banking operations": {
        "banking operations",
        "bank operation",
        "core banking operations",
    },
    "core banking": {"core banking", "cbs", "core banking system"},
    "kyc": {"kyc", "know your customer"},
    "aml": {"aml", "anti money laundering"},
    "risk management": {"risk management", "credit risk", "operational risk"},
    "credit analysis": {"credit analysis", "loan analysis"},
    "reconciliation": {"reconciliation", "account reconciliation"},
    "financial reporting": {"financial reporting", "finance reporting"},
    "accounting": {"accounting", "bookkeeping"},
    "tally": {"tally", "tally erp"},

    # Sales / Marketing / CRM
    "sales": {"sales", "inside sales", "field sales"},
    "lead generation": {"lead generation", "lead gen"},
    "business development": {"business development", "bd"},
    "digital marketing": {"digital marketing", "online marketing"},
    "seo": {"seo", "search engine optimization"},
    "sem": {"sem", "search engine marketing"},
    "social media marketing": {"social media marketing", "smm"},
    "content marketing": {"content marketing"},
    "email marketing": {"email marketing"},
    "google ads": {"google ads", "adwords", "google adwords"},
    "meta ads": {"meta ads", "facebook ads", "instagram ads"},
    "crm": {"crm", "customer relationship management", "salesforce", "hubspot"},
    "customer service": {"customer service", "customer support"},
    "communication": {"communication", "verbal communication", "written communication"},
}


def _normalize_token(value):
    text = str(value).strip().lower()
    text = text.replace("&", " and ")
    text = re.sub(r"[^\w\s.+#/-]", " ", text)
    text = text.replace("/", " ")
    text = text.replace("-", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def canonicalize_skill(value):
    token = _normalize_token(value)
    if not token:
        return ""
    for canonical, variants in SKILL_ALIASES.items():
        if token in variants:
            return canonical
    return token
