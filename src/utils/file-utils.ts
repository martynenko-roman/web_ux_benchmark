import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { existsSync } from "fs";

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
}

export async function writeJsonFile<T>(
  filePath: string,
  data: T
): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function ensureDirExists(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

