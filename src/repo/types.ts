import { Event } from "vscode";

export interface JestExecutionParams {
  jestCommand: string;
  jestExecutionDirectory: string;
}

export interface ProjectConfig extends JestExecutionParams {
  jestConfig?: string;
  projectName: string;
  rootPath: string;
  tsConfig?: string;
}

export type ProjectChangeEvent =
  | {
    type: "added";
    config: ProjectConfig;
  }
  | {
    type: "removed";
    rootPath: string;
  };

export interface RepoParser {
  type: string;
  isMatch: () => Promise<boolean>;
  getProjects: () => Promise<ProjectConfig[]>;
  readonly projectChange: Event<ProjectChangeEvent>;
}
