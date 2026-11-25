export type PublicDataSource = 'products' | 'documentation';

export class PublicDataUnavailableError extends Error {
  constructor(readonly source: PublicDataSource) {
    super(`Public ${source} data is unavailable.`);
    this.name = 'PublicDataUnavailableError';
  }
}
