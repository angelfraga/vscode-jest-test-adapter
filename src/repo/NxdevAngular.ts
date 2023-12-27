import path from "path";
import { Log } from "vscode-test-adapter-util";
import { NxdevBase } from "./NxdevBase";
import { ProjectConfig, RepoParser } from "./types";

interface AngularConfig {
  test: {
    builder: string;
    options: {
      jestConfig: string;
      tsConfig?: string;
      setupFile?: string;
    };
  };
};

interface ProjectsConfig {
  test: {
    executor: string;
    options: {
      jestConfig: string;
      tsConfig?: string;
      setupFile?: string;
    };
  };
};

interface NxAngular {
  architect?: AngularConfig;
  targets?: ProjectsConfig;
};

class NxdevAngular extends NxdevBase<NxAngular> implements RepoParser {
  public type = "Nx.dev Angular";

  protected configFileName = "angular.json";

  constructor(workspaceRoot: string, log: Log, pathToJest: string) {
    super(workspaceRoot, log, pathToJest);
  }

  protected configFilter = ([, projectConfig]: [string, NxAngular]): boolean => {
    return (
      projectConfig.architect?.test?.builder === "@nrwl/jest:jest" ||
      projectConfig.targets?.test?.executor === "@nrwl/jest:jest"
    );
  }

  protected configMap = ([projectName, projectConfig]: [string, NxAngular]): ProjectConfig | undefined => {
    const options = projectConfig.architect?.test.options ?? projectConfig.targets?.test.options;

    if (!options) {
      return undefined;
    }

    return {
      ...this.getJestExecutionParameters(projectName),
      jestConfig: path.resolve(this.workspaceRoot, options.jestConfig),
      projectName,
      rootPath: path.resolve(this.workspaceRoot, path.dirname(options.jestConfig)),
      setupFile: options.setupFile && path.resolve(this.workspaceRoot, options.setupFile),
      tsConfig: options.tsConfig && path.resolve(this.workspaceRoot, options.tsConfig),
    };
  };
}

export { NxdevAngular };
