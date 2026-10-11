import { createMemoryRepo } from './memory-repo';
import { createPostgresRepo } from './postgres-repo';
import type { ResultsRepo } from './repo';

const store = globalThis as typeof globalThis & { __pisResultsRepo?: ResultsRepo | null };

export function getRepo(): ResultsRepo {
  if (store.__pisResultsRepo) return store.__pisResultsRepo;
  const url = process.env.DATABASE_URL;
  let repo: ResultsRepo;
  if (url) {
    repo = createPostgresRepo(url);
  } else if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_MEMORY_STORE === '1') {
    repo = createMemoryRepo();
  } else {
    throw new Error('DATABASE_URL is not configured');
  }
  store.__pisResultsRepo = repo;
  return repo;
}

/** Tests only: replace or reset the shared repository. */
export function setRepoForTests(repo: ResultsRepo | null): void {
  store.__pisResultsRepo = repo;
}
