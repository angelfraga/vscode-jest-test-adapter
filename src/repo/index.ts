import { Log } from "vscode-test-adapter-util";
import { CreateReactAppParser } from "./CreateReactAppParser";
import { NxRepositoryParser } from "./NxRepositoryParser";
import { StandardParser } from "./StandardParser";
import { ProjectConfig, RepoParser } from "./types";
import first from 'lodash/first';

/**
 * Returns a RepoParser if one matches the given workspaceRoot otherwise returns null.
 */
const getRepoParser = async (workspaceRoot: string, log: Log, pathToJest: string): Promise<RepoParser | null> => {
  const repoParsers: RepoParser[] = [
    new NxRepositoryParser(workspaceRoot, log, pathToJest),
    new CreateReactAppParser(workspaceRoot, log, pathToJest),
    new StandardParser(workspaceRoot, log, pathToJest),
  ];

  const matchingParsers = await Promise.all(
    repoParsers.map(async p => ({ parser: p, match: await p.isMatch() })),
  ).then(x => x.filter(z => z.match).map(z => z.parser));

  const parser = first(matchingParsers) || null;
  log.info(`Selected parser: ${parser?.type || 'none'}`)
  return parser;
};

export { ProjectConfig, RepoParser, getRepoParser };
