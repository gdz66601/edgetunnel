import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";
const ENTRY_MODULE = "_worker.js";
const KV_BINDING_NAME = "KV";

async function main() {
  const config = loadConfigFromEnv(process.env);
  const compatibilityDate =
    config.compatibilityDate || (await readCompatibilityDate("wrangler.toml"));
  const kvNamespace = await ensureKvNamespace(config, config.kvNamespaceTitle);
  const workerSource = await readWorkerSource(ENTRY_MODULE);
  const metadata = buildMetadata({
    compatibilityDate,
    kvNamespaceId: kvNamespace.id,
    plaintextBindings: config.plaintextBindings,
    secretBindings: config.secretBindings,
    commitSha: config.commitSha,
  });

  await uploadWorker({
    config,
    metadata,
    workerSource,
  });

  console.log(
    `Deployment complete. Worker "${config.workerName}" is bound to KV namespace "${kvNamespace.title}" (${kvNamespace.id}).`,
  );
}

function loadConfigFromEnv(env) {
  const apiToken = requireEnv(env, "CF_API_TOKEN");
  const accountId = requireEnv(env, "CF_ACCOUNT_ID");
  const kvNamespaceTitle = requireEnv(env, "CF_KV_NAMESPACE_TITLE");
  const workerName = resolveWorkerName(env);
  const secretBindings = parseBindingsJson({
    raw: env.CF_WORKER_SECRET_BINDINGS_JSON || "{}",
    envName: "CF_WORKER_SECRET_BINDINGS_JSON",
  });
  const plaintextBindings = parseBindingsJson({
    raw: env.CF_WORKER_PLAINTEXT_BINDINGS_JSON || "{}",
    envName: "CF_WORKER_PLAINTEXT_BINDINGS_JSON",
  });
  const compatibilityDate = env.CF_COMPATIBILITY_DATE?.trim() || "";
  const commitSha = (env.GITHUB_SHA || "manual").trim();
  const admin = env.ADMIN?.trim();

  if (admin) {
    secretBindings.ADMIN = admin;
  }

  if (!Object.prototype.hasOwnProperty.call(secretBindings, "ADMIN")) {
    throw new Error(
      'Missing admin password. Set GitHub Secret "ADMIN" or include "ADMIN" in CF_WORKER_SECRET_BINDINGS_JSON.',
    );
  }

  return {
    accountId,
    apiToken,
    commitSha,
    compatibilityDate,
    kvNamespaceTitle,
    plaintextBindings,
    secretBindings,
    workerName,
  };
}

function requireEnv(env, name) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function resolveWorkerName(env) {
  const configuredName = env.CF_WORKER_NAME?.trim();
  if (configuredName) {
    return configuredName;
  }

  const repositoryId = env.GITHUB_REPOSITORY_ID?.trim();
  const repository = env.GITHUB_REPOSITORY?.trim() || "repo";
  if (!repositoryId) {
    throw new Error(
      "CF_WORKER_NAME is not set and GITHUB_REPOSITORY_ID is unavailable, so a stable Worker name cannot be generated.",
    );
  }

  const repoSlug = repository
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "repo";
  const suffix = createHash("sha256")
    .update(`${repositoryId}:${repository}`)
    .digest("hex")
    .slice(0, 10);
  const generatedName = `edt-${repoSlug}-${suffix}`.slice(0, 63);

  console.log(
    `CF_WORKER_NAME is not set. Using auto-generated stable Worker name "${generatedName}".`,
  );
  return generatedName;
}

function parseBindingsJson({ raw, envName }) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${envName} must be valid JSON: ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${envName} must be a JSON object.`);
  }

  const normalized = {};
  for (const [name, value] of Object.entries(parsed)) {
    validateBindingName(name, envName);

    if (value === null || value === undefined) {
      throw new Error(`${envName}.${name} must not be null or undefined.`);
    }

    normalized[name] = String(value);
  }

  return normalized;
}

function validateBindingName(name, envName) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(
      `${envName} contains invalid binding name "${name}". Use letters, numbers, and underscores, and do not start with a number.`,
    );
  }
}

async function readCompatibilityDate(filePath) {
  const contents = await readFile(filePath, "utf8");
  const match = contents.match(
    /^\s*compatibility_date\s*=\s*["'](\d{4}-\d{2}-\d{2})["']/m,
  );

  if (!match) {
    throw new Error(
      "CF_COMPATIBILITY_DATE is not set and wrangler.toml does not contain compatibility_date.",
    );
  }

  return match[1];
}

async function readWorkerSource(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(`Unable to read ${filePath}: ${error.message}`);
  }
}

async function ensureKvNamespace(config, title) {
  const namespaces = await listAllKvNamespaces(config);
  const matches = namespaces.filter((namespace) => namespace.title === title);

  if (matches.length === 1) {
    console.log(`Reusing existing KV namespace "${title}" (${matches[0].id}).`);
    return matches[0];
  }

  if (matches.length > 1) {
    throw new Error(
      `Found multiple KV namespaces with title "${title}". Refusing to guess which one to bind.`,
    );
  }

  console.log(`KV namespace "${title}" does not exist yet. Creating it now.`);
  try {
    return await createKvNamespace(config, title);
  } catch (error) {
    if (error instanceof CloudflareApiError && error.status === 400) {
      const retryNamespaces = await listAllKvNamespaces(config);
      const retryMatches = retryNamespaces.filter(
        (namespace) => namespace.title === title,
      );
      if (retryMatches.length === 1) {
        console.log(
          `KV namespace "${title}" was created concurrently. Reusing ${retryMatches[0].id}.`,
        );
        return retryMatches[0];
      }
    }

    throw error;
  }
}

async function listAllKvNamespaces(config) {
  const namespaces = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const params = new URLSearchParams({
      order: "title",
      direction: "asc",
      page: String(page),
      per_page: "1000",
    });
    const response = await cfApiJson(
      config,
      `/accounts/${config.accountId}/storage/kv/namespaces?${params.toString()}`,
    );

    const pageResults = Array.isArray(response.result) ? response.result : [];
    namespaces.push(...pageResults);
    totalPages = Math.max(page, Number(response.result_info?.total_pages || 1));
    page += 1;
  }

  return namespaces;
}

async function createKvNamespace(config, title) {
  const response = await cfApiJson(
    config,
    `/accounts/${config.accountId}/storage/kv/namespaces`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    },
  );

  console.log(`Created KV namespace "${title}" (${response.result.id}).`);
  return response.result;
}

function buildMetadata({
  compatibilityDate,
  kvNamespaceId,
  plaintextBindings,
  secretBindings,
  commitSha,
}) {
  const bindings = [
    {
      type: "kv_namespace",
      name: KV_BINDING_NAME,
      namespace_id: kvNamespaceId,
    },
    ...Object.entries(plaintextBindings).map(([name, text]) => ({
      type: "plain_text",
      name,
      text,
    })),
    ...Object.entries(secretBindings).map(([name, text]) => ({
      type: "secret_text",
      name,
      text,
    })),
  ];

  const shortSha = commitSha.slice(0, 12) || "manual";

  return {
    main_module: ENTRY_MODULE,
    compatibility_date: compatibilityDate,
    bindings,
    annotations: {
      "workers/message": `Deploy from GitHub Actions (${shortSha})`,
      "workers/tag": shortSha,
    },
    tags: [`git:${shortSha}`],
  };
}

async function uploadWorker({ config, metadata, workerSource }) {
  const formData = new FormData();
  formData.set(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
    "metadata.json",
  );
  formData.set(
    ENTRY_MODULE,
    new Blob([workerSource], { type: "application/javascript+module" }),
    ENTRY_MODULE,
  );

  await cfApiJson(
    config,
    `/accounts/${config.accountId}/workers/scripts/${encodeURIComponent(
      config.workerName,
    )}`,
    {
      method: "PUT",
      body: formData,
    },
  );

  console.log(
    `Uploaded Worker "${config.workerName}" with compatibility_date ${metadata.compatibility_date}.`,
  );
}

async function cfApiJson(config, path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${config.apiToken}`);

  const response = await fetch(`${CF_API_BASE}${path}`, {
    ...init,
    headers,
  });

  let body;
  try {
    body = await response.json();
  } catch (error) {
    throw new Error(
      `Cloudflare API returned a non-JSON response for ${path}: ${error.message}`,
    );
  }

  if (!response.ok || body.success === false) {
    throw new CloudflareApiError({
      path,
      status: response.status,
      body,
    });
  }

  return body;
}

class CloudflareApiError extends Error {
  constructor({ path, status, body }) {
    super(formatCloudflareError(path, status, body));
    this.name = "CloudflareApiError";
    this.path = path;
    this.status = status;
    this.body = body;
  }
}

function formatCloudflareError(path, status, body) {
  const messages = [];

  const errors = Array.isArray(body?.errors) ? body.errors : [];
  const apiMessages = Array.isArray(body?.messages) ? body.messages : [];

  for (const entry of [...errors, ...apiMessages]) {
    if (!entry) continue;
    const code = entry.code ? ` [${entry.code}]` : "";
    const message = entry.message || JSON.stringify(entry);
    messages.push(`${message}${code}`);
  }

  const hint = buildPermissionHint(status, messages);
  const details = messages.length > 0 ? messages.join("; ") : "No error details returned.";
  return `Cloudflare API request failed for ${path} (HTTP ${status}). ${details}${hint}`;
}

function buildPermissionHint(status, messages) {
  const lowered = messages.join(" ").toLowerCase();
  if (status === 403 || lowered.includes("permission") || lowered.includes("unauthorized")) {
    return " Check that CF_API_TOKEN includes Workers Scripts Write and Workers KV Storage Read/Write.";
  }
  return "";
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
