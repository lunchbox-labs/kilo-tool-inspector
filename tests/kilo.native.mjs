import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const { version } = JSON.parse(
  await readFile(new URL("./kilo.json", import.meta.url), "utf8"),
);
assert.equal(
  process.platform,
  "linux",
  "Native TUI checks require Linux with util-linux script.",
);
assert.equal(process.arch, "x64", "Native test installation requires x64.");
assert.equal(
  spawnSync("script", ["--version"]).status,
  0,
  "Install util-linux for a native pseudoterminal.",
);
const repository = fileURLToPath(new URL("../", import.meta.url));
const root = await mkdtemp(join(tmpdir(), "kilo-tool-inspector-"));
const config = join(root, "config", "kilo");
const project = join(root, "project");
const runtime = join(root, "runtime");
const npm = process.env.npm_execpath;
assert.ok(npm, "Run this check through npm.");
const env = {
  PATH: process.env.PATH,
  HOME: root,
  TMPDIR: join(root, "tmp"),
  XDG_CONFIG_HOME: join(root, "config"),
  XDG_DATA_HOME: join(root, "data"),
  XDG_STATE_HOME: join(root, "state"),
  XDG_CACHE_HOME: join(root, "cache"),
  KILO_TEST_HOME: root,
  KILO_DB: join(root, "kilo.sqlite"),
  KILO_DISABLE_AUTOUPDATE: "true",
  KILO_NO_DAEMON: "1",
  KILO_TELEMETRY_LEVEL: "off",
  KILO_DISABLE_MODELS_FETCH: "true",
  KILO_DISABLE_PROJECT_CONFIG: "true",
  KILO_DISABLE_DEFAULT_PLUGINS: "true",
  KILO_DISABLE_EXTERNAL_SKILLS: "true",
  KILO_DISABLE_CLAUDE_CODE: "true",
  KILO_EXPERIMENTAL_DISABLE_FILEWATCHER: "true",
  TERM: "xterm-256color",
  COLORTERM: "truecolor",
  LANG: "C.UTF-8",
  KILO_INSPECTOR_MARKER: join(root, "result.json"),
};
for (const name of [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "NODE_EXTRA_CA_CERTS",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "npm_config_cafile",
]) {
  if (process.env[name]) {
    env[name] = process.env[name];
  }
}
const run = (command, args, cwd = repository) => {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    timeout: 180_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  return result.stdout;
};
let child;
let logs = "";
try {
  for (const directory of [config, project, runtime, env.TMPDIR]) {
    await mkdir(directory, { recursive: true });
  }
  const cache = process.env.npm_config_cache ?? join(root, "npm-cache");
  let binary = process.env.KILO_BIN;
  if (!binary) {
    run(process.execPath, [
      npm,
      "install",
      "--prefix",
      runtime,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--cache",
      cache,
      `@kilocode/cli-linux-x64-baseline@${version}`,
    ]);
    binary = join(
      runtime,
      "node_modules/@kilocode/cli-linux-x64-baseline/bin/kilo",
    );
  }
  assert.equal(run(binary, ["--version"]).trim(), version);
  const [{ filename }] = JSON.parse(
    run(process.execPath, [
      npm,
      "pack",
      "--ignore-scripts",
      "--json",
      "--pack-destination",
      root,
      "--cache",
      cache,
    ]),
  );
  run(process.execPath, [
    npm,
    "install",
    "--prefix",
    runtime,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--cache",
    cache,
    join(root, filename),
  ]);
  const plugin = join(
    runtime,
    "node_modules/@lunchbox-labs/kilo-tool-inspector",
  );
  await cp(
    join(repository, "tests/kilo-tui.fixture.ts"),
    join(config, "audit.ts"),
  );
  await writeFile(
    join(config, "tui.json"),
    JSON.stringify({ plugin: [plugin, "./audit.ts"] }),
  );
  await writeFile(
    join(config, "kilo.json"),
    JSON.stringify({
      plugin: [],
      model: "openai/native-fixture",
      enabled_providers: ["openai"],
      provider: {
        openai: {
          options: {
            apiKey: "synthetic-test-key",
            baseURL: "http://127.0.0.1:1/v1",
          },
          models: {
            "native-fixture": {
              name: "Native fixture",
              limit: { context: 4096, output: 1024 },
            },
          },
        },
      },
    }),
  );
  const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  child = spawn(
    "script",
    [
      "-q",
      "-c",
      `stty cols 120 rows 50; ${quote(binary)} --print-logs`,
      "/dev/null",
    ],
    { cwd: project, env, detached: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  for (const output of [child.stdout, child.stderr]) {
    output.on("data", (chunk) => {
      logs = (logs + chunk.toString()).slice(-64 * 1024);
    });
  }
  let result;
  for (let attempt = 0; attempt < 1200; attempt++) {
    try {
      result = JSON.parse(await readFile(env.KILO_INSPECTOR_MARKER, "utf8"));
      break;
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
    if (child.exitCode !== null || child.signalCode !== null) {
      break;
    }
    await delay(100);
  }
  assert.ok(result, `Native audit did not finish:\n${logs}`);
  assert.equal(result.error, undefined, JSON.stringify(result) + "\n" + logs);
  assert.equal(result.stages.length, 5);
  console.log(`PASS Kilo CLI ${version}: ${result.stages.join("; ")}.`);
  console.log(
    "No prompts or tool calls were sent to a model. Native smoke does not prove final call-time permission decisions.",
  );
} finally {
  if (child?.pid && child.exitCode === null && child.signalCode === null) {
    process.kill(-child.pid, "SIGTERM");
    await Promise.race([once(child, "exit"), delay(2000)]);
    if (child.exitCode === null && child.signalCode === null) {
      process.kill(-child.pid, "SIGKILL");
      await Promise.race([once(child, "exit"), delay(2000)]);
    }
  }
  await rm(root, { recursive: true, force: true });
}
