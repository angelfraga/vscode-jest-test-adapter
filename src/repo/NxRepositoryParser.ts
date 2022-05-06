import { JSONSchemaForNPMPackageJsonFiles } from "@schemastore/package";
import fs, { readFileSync } from "fs";
import _ from "lodash";
import path from "path";
import { gt } from "semver";
import util from "util";
import vscode from "vscode";
import { Log } from "vscode-test-adapter-util";
import { EXPERIMENTAL_NX_CLI_FEATURE_TOGGLE, EXTENSION_CONFIGURATION_NAME } from "../constants";
import RepoParserBase from "./RepoParserBase";
import { JestExecutionParams, ProjectConfig, RepoParser } from "./types";

// the following requires Node 8 minimum.
export const exists = util.promisify(fs.exists);
export const readFile = util.promisify(fs.readFile);

interface NxJestOptions {
  jestConfig: string;
  tsConfig?: string;
  setupFile?: string;
}

interface NxProject {
  projectType: string;
  sourceRoot: string;
  tags: string[];
  targets: {
    [target: string]: {
      executor: string;
    } & Partial<{ [other: string]: unknown }>
  }
}

interface NxWorkspace {
  version: 2;
  projects: {
    [name: string]: string | NxProject;
  }
}


class NxRepositoryParser extends RepoParserBase implements RepoParser {
  public readonly type: string = 'Nx v2 Workspace';

  private useExperimentalCli?: boolean;

  constructor(workspaceRoot: string, log: Log, pathToJest: string) {
    super(workspaceRoot, log, pathToJest);
  }

  public async getConfigFileName(): Promise<string> {
    const angularConfigFilePath = path.resolve(this.workspaceRoot, "angular.json");
    const isAngularWorkspace = await fs.existsSync(angularConfigFilePath);
    if (isAngularWorkspace) {
      return "angular.json";
    }
    return "workspace.json";
  }

  public async getProjects(): Promise<ProjectConfig[]> {
    const configFileName = await this.getConfigFileName();
    await this.ensureUseExperimentalCliDetermined();
    const buffer = await readFile(path.resolve(this.workspaceRoot, configFileName));
    const workspaceConfig = JSON.parse(buffer.toString()) as NxWorkspace;

    const projectConfigs = Object.entries(workspaceConfig.projects)
      .map(entry => this.toNxProjectConfig(entry))
      .filter(this.isProjectWithJestTarget)
      .map(entry => this.toProjectConfig(entry));

    return projectConfigs;
  }

  public async isMatch(): Promise<boolean> {
    const configFileName = await this.getConfigFileName();
    return (
      (await exists(path.resolve(this.workspaceRoot, configFileName))) &&
      (await exists(path.resolve(this.workspaceRoot, "nx.json")))
    );
  }

  private isProjectWithJestTarget([_name, config]: [string, NxProject]) {
    return config?.targets?.test?.executor === "@nrwl/jest:jest";
  }

  private toProjectConfig([projectName, config]: [string, NxProject]): ProjectConfig {
    const options = config.targets.test.options as NxJestOptions;
    const executionParams = this.getJestExecutionParameters(projectName);
    return {
      ...executionParams,
      jestConfig: path.resolve(this.workspaceRoot, options.jestConfig),
      projectName,
      rootPath: path.resolve(this.workspaceRoot, path.dirname(options.jestConfig)),
      tsConfig: options.tsConfig && path.resolve(this.workspaceRoot, options.tsConfig),
    };
  };

  private toNxProjectConfig([project, config]: [string, string | NxProject]): [string, NxProject] {
    if (typeof config === 'string') {
      const projectConfigFilePath = path.resolve(this.workspaceRoot, config, 'project.json');
      const buffer = readFileSync(projectConfigFilePath);
      const projectConfig = JSON.parse(buffer.toString()) as NxProject;
      return [project, projectConfig];
    }
    return [project, config as NxProject];
  }

  protected getJestExecutionParameters(projectName: string): JestExecutionParams {
    if (this.useExperimentalCli) {
      return {
        jestCommand: `nx test ${projectName}`,
        jestExecutionDirectory: this.workspaceRoot,
      };
    }
    return this.getJestCommandAndDirectory();
  }

  /**
   * check if the version of Nx is high enough to support fetching questions using the Nx CLI and that the feature
   * toggle is enabled.
   */
  private async ensureUseExperimentalCliDetermined() {
    if (this.useExperimentalCli !== undefined) {
      return;
    }

    const featureToggles =
      vscode.workspace.getConfiguration(EXTENSION_CONFIGURATION_NAME, null).get<string[]>("featureToggles") || [];

    const nxCommandFeatureToggleEnabled = _.some(featureToggles, EXPERIMENTAL_NX_CLI_FEATURE_TOGGLE);

    const packageFile = await this.getPackageFile(this.workspaceRoot);

    if (!packageFile) {
      this.useExperimentalCli = false;
    } else {
      const nxVersion = await getNxVersion(packageFile);
      this.useExperimentalCli = nxCommandFeatureToggleEnabled && gt(nxVersion, "9.2.4");
    }
  }
}

const getNxVersion = async (packageJson: JSONSchemaForNPMPackageJsonFiles) => {
  let nxVersion;

  if (packageJson.dependencies) {
    nxVersion = packageJson.dependencies["@nrwl/jest"];
    if (nxVersion) {
      return nxVersion;
    }
  }

  if (packageJson.devDependencies) {
    nxVersion = packageJson.devDependencies["@nrwl/jest"];
    if (nxVersion) {
      return nxVersion;
    }
  }

  return "0.0.0";
};

export { NxRepositoryParser };
