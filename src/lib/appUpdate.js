export async function fetchRemoteVersion() {
  const res = await fetch(`/version.json?ts=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  if (!res.ok) throw new Error("No se pudo consultar la versión");
  return res.json();
}

export function isNewerBuild(localBuild, remoteBuild) {
  if (!localBuild?.version || !remoteBuild?.version) return false;
  return localBuild.version !== remoteBuild.version;
}
