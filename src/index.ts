import * as actionsCore from "@actions/core";
import * as actionsExec from "@actions/exec";
import { DetSysAction, inputs } from "detsys-ts";

class FlakeCheckerAction extends DetSysAction {
  flakeLockPath: string;
  nixpkgsKeys: string;
  checkOutdated: boolean;
  checkOwner: boolean;
  checkSupported: boolean;
  ignoreMissingFlakeLock: boolean;
  failMode: boolean;
  sendStatistics: boolean;

  constructor() {
    super({
      name: "flake-checker",
      fetchStyle: "gh-env-style",
      diagnosticsUrl: new URL(
        "https://install.determinate.systems/flake-checker/telemetry",
      ),
      // We don't need Nix in this Action because we fetch a static binary using curl and run it
      requireNix: "ignore",
    });

    this.flakeLockPath = inputs.getString("flake-lock-path");
    this.nixpkgsKeys = inputs.getString("nixpkgs-keys");
    this.checkOutdated = inputs.getBool("check-outdated");
    this.checkOwner = inputs.getBool("check-owner");
    this.checkSupported = inputs.getBool("check-supported");
    this.ignoreMissingFlakeLock = inputs.getBool("ignore-missing-flake-lock");
    this.failMode = inputs.getBool("fail-mode");
    this.sendStatistics = inputs.getBool("send-statistics");
  }

  async main(): Promise<void> {
    await this.checkFlake();
  }

  // No post step
  async post(): Promise<void> {}

  private async executionEnvironment(): Promise<ExecuteEnvironment> {
    const executionEnv: ExecuteEnvironment = {};

    executionEnv.NIX_FLAKE_CHECKER_FLAKE_LOCK_PATH = this.flakeLockPath;
    executionEnv.NIX_FLAKE_CHECKER_NIXPKGS_KEYS = this.nixpkgsKeys;

    if (!this.sendStatistics) {
      executionEnv.NIX_FLAKE_CHECKER_NO_TELEMETRY = "false";
    }

    if (!this.checkOutdated) {
      executionEnv.NIX_FLAKE_CHECKER_CHECK_OUTDATED = "false";
    }

    if (!this.checkOwner) {
      executionEnv.NIX_FLAKE_CHECKER_CHECK_OWNER = "false";
    }

    if (!this.checkSupported) {
      executionEnv.NIX_FLAKE_CHECKER_CHECK_SUPPORTED = "false";
    }

    if (!this.ignoreMissingFlakeLock) {
      executionEnv.NIX_FLAKE_CHECKER_IGNORE_MISSING_FLAKE_LOCK = "false";
    }

    if (this.failMode) {
      executionEnv.NIX_FLAKE_CHECKER_FAIL_MODE = "true";
    }

    return executionEnv;
  }

  async checkFlake(): Promise<number> {
    const binaryPath = await this.fetchExecutable();

    const executionEnv = await this.executionEnvironment();

    actionsCore.debug(
      `Execution environment: ${JSON.stringify(executionEnv, null, 4)}`,
    );

    const exitCode = await actionsExec.exec(binaryPath, [], {
      env: {
        ...executionEnv,
        ...process.env, // To get $PATH, etc
      },
      ignoreReturnCode: true,
    });

    if (exitCode !== 0) {
      this.recordEvent("execution_failure", {
        exitCode,
      });
      actionsCore.setFailed(`Non-zero exit code of \`${exitCode}\`.`);
    }

    return exitCode;
  }
}

type ExecuteEnvironment = {
  // All env vars are strings, no fanciness here.
  RUST_BACKTRACE?: string;
  NIX_FLAKE_CHECKER_FLAKE_LOCK_PATH?: string;
  NIX_FLAKE_CHECKER_NIXPKGS_KEYS?: string;
  NIX_FLAKE_CHECKER_NO_TELEMETRY?: string;
  NIX_FLAKE_CHECKER_CHECK_OUTDATED?: string;
  NIX_FLAKE_CHECKER_CHECK_OWNER?: string;
  NIX_FLAKE_CHECKER_CHECK_SUPPORTED?: string;
  NIX_FLAKE_CHECKER_IGNORE_MISSING_FLAKE_LOCK?: string;
  NIX_FLAKE_CHECKER_FAIL_MODE?: string;
};

function main(): void {
  new FlakeCheckerAction().execute();
}

main();
