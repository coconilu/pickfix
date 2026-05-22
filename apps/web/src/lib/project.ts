export interface ProjectInfo {
  root: string;
  name: string;
  key: string;
}

export async function fetchProjectInfo(): Promise<ProjectInfo> {
  const res = await fetch("/api/project", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}
