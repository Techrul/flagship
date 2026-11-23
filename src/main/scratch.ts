// Everything that talks to Scratch's servers lives here.
import * as SBDL from '@turbowarp/sbdl';

export interface ScratchMetadata {
  id: string;
  title: string;
  author: string;
  instructions: string;
  description: string;
  thumbnailUrl: string;
}

/**
 * Accepts anything a person might paste and returns the numeric project ID, or null.
 * Examples: "104", "https://scratch.mit.edu/projects/104/", "scratch.mit.edu/projects/104/editor",
 * "https://turbowarp.org/104?fps=60", "turbowarp.org/editor#104"
 */
export function parseProjectInput(input: string): string | null {
  const text = input.trim();
  if (/^\d{1,12}$/.test(text)) return text;

  const patterns = [
    /scratch\.mit\.edu\/projects\/(\d{1,12})/i,
    /turbowarp\.org\/(?:editor|fullscreen|embed)?[#/]?(\d{1,12})(?:[/?#]|$)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export class ScratchError extends Error {}

export async function fetchMetadata(id: string): Promise<ScratchMetadata> {
  let response: Response;
  try {
    response = await fetch(`https://api.scratch.mit.edu/projects/${id}`);
  } catch {
    throw new ScratchError("Couldn't reach Scratch. Check your internet connection.");
  }
  if (response.status === 404) {
    throw new ScratchError(`Project ${id} wasn't found. It might be unshared or deleted.`);
  }
  if (!response.ok) {
    throw new ScratchError(`Scratch returned an error (HTTP ${response.status}). Try again later.`);
  }
  const data = (await response.json()) as any;
  return {
    id,
    title: String(data.title || `Project ${id}`),
    author: String(data.author?.username || 'Unknown'),
    instructions: String(data.instructions || ''),
    description: String(data.description || ''),
    thumbnailUrl: String(data.images?.['480x360'] || data.image || ''),
  };
}

/** Downloads the full project (project.json + every asset) as a single .sb3/.sb2/.sb buffer. */
export async function downloadProject(
  id: string,
  onProgress?: (fraction: number) => void,
): Promise<{ data: Uint8Array; type: string }> {
  try {
    const project = await SBDL.downloadProjectFromID(id, {
      onProgress: (type: string, loaded: number, total: number) => {
        // Assets are the slow part, so let them drive the progress bar.
        if (type === 'assets' && total > 0) onProgress?.(loaded / total);
      },
    });
    return { data: new Uint8Array(project.arrayBuffer), type: project.type };
  } catch (error) {
    throw new ScratchError(`Downloading the project failed: ${(error as Error).message}`);
  }
}

export async function downloadThumbnail(url: string): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null; // A missing thumbnail should never block adding a game.
  }
}
