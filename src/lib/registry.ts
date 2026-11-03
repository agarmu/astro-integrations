import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

declare global {
  var __astroIntegrationsRegistries: Map<string, unknown> | undefined;
}

interface RegistryData<T, State> {
  files: Map<string, T>;
  state: State;
}

export abstract class PathRegistry<T, State = undefined> implements Iterable<
  [string, T]
> {
  private readonly files: Map<string, T>;
  protected readonly state: State;

  protected constructor(name: string, initialState: State) {
    const registries = (globalThis.__astroIntegrationsRegistries ??= new Map());
    const existing = registries.get(name) as RegistryData<T, State> | undefined;
    const registry = existing ?? {
      files: new Map<string, T>(),
      state: initialState,
    };
    registries.set(name, registry);
    this.files = registry.files;
    this.state = registry.state;
  }

  register(pathname: string, value: T): string {
    PathRegistry.assertPath(pathname);
    this.validate(pathname, value);
    this.files.set(pathname, value);
    return pathname;
  }

  protected abstract validate(pathname: string, value: T): void;

  protected hash(value: Uint8Array): string {
    return createHash("sha256").update(value).digest("hex");
  }

  get(pathname: string): T | undefined {
    return this.files.get(pathname);
  }

  getRequest(requestUrl: string | undefined): T | undefined {
    const pathname = new URL(requestUrl ?? "/", "https://example.invalid")
      .pathname;
    return this.get(pathname);
  }

  async write(pathname: string, dir: URL, body: Uint8Array): Promise<void> {
    PathRegistry.assertPath(pathname);
    const target = new URL(`.${pathname}`, dir);
    await mkdir(new URL("./", target), { recursive: true });
    await writeFile(target, body);
  }

  clear(): void {
    this.files.clear();
  }

  [Symbol.iterator](): MapIterator<[string, T]> {
    return this.files[Symbol.iterator]();
  }

  protected static assertPath(pathname: string): void {
    if (
      !pathname.startsWith("/") ||
      pathname.includes("?") ||
      pathname.includes("#") ||
      new URL(pathname, "https://example.invalid").pathname !== pathname
    ) {
      throw new Error("Registry path must be an absolute URL path");
    }
  }
}
