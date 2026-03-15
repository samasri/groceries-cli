export interface BuildIdProvider {
  getBuildId(): Promise<string>;
  invalidate(): Promise<void>;
}
