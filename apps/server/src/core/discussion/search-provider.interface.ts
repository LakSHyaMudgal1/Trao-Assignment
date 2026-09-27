import type { RawSearchResult, SearchOptions } from './discussion.types.js';

/**
 * Replaceable Search Provider Interface
 */
export interface ISearchProvider {
  readonly name: string;
  search(query: string, options?: SearchOptions): Promise<RawSearchResult[]>;
}
