import axios, { AxiosInstance } from 'axios';
import { createWriteStream } from 'fs';
import { mkdir, stat as fsStat, writeFile, readFile } from 'fs/promises';
import path from 'path';

type RemoteFileMetadata = {
  date?: string;
  contentLength?: string;
};

export class NutellaClient {
  private axiosInstance: AxiosInstance;
  private apiHost: string;

  /**
   * Create a NutellaClient.
   * - If `authToken` is provided it will be sent as `Authorization: Basic <token>`.
   * - Otherwise cookies (if any) will be sent in the Cookie header.
   */
  constructor(apiHost: string, authToken?: string, cookies: Record<string, string> = {}) {
    this.apiHost = apiHost;

    const headers: Record<string, string> = {};

    // Prefer Authorization header when authToken is provided
    if (authToken) {
      headers['Authorization'] = `Basic ${authToken}`;
    } else if (cookies && Object.keys(cookies).length > 0) {
      headers['Cookie'] = Object.entries(cookies)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('; ');
    }

    this.axiosInstance = axios.create({
      headers,
      withCredentials: true,
    });
  }

  public async getUsers() {
    const url = `${this.apiHost}/users`;

    // Prepare cache: directory and filename per host + hourly bucket
    try {
      const cacheDir = process.env.NUTELLA_CACHE_DIR ?? path.join(process.cwd(), '.cache', 'nutella');
      await mkdir(cacheDir, { recursive: true });

      const hostName = new URL(this.apiHost).hostname.replace(/[:\/\\]/g, '_');
      const now = new Date();
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, '0');
      const d = String(now.getUTCDate()).padStart(2, '0');
      const h = String(now.getUTCHours()).padStart(2, '0');
      const cacheFile = path.join(cacheDir, `${hostName}_users_${y}${m}${d}T${h}Z.json`);

      // If cache exists and is recent (same hourly file), use it
      try {
        const s = await fsStat(cacheFile);
        const ageMs = Date.now() - s.mtime.getTime();
        if (ageMs < 1000 * 60 * 60) {
          const text = await readFile(cacheFile, { encoding: 'utf8' });
          return JSON.parse(text);
        }
      } catch (err) {
        // cache miss -> continue to fetch
      }

      // Fetch from remote and update cache
      try {
        const response = await this.axiosInstance.get(url);
        const data = response.data;
        // write cache atomically (write to temp then rename)
        const tmp = cacheFile + '.tmp';
        await writeFile(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8' });
        await writeFile(cacheFile, JSON.stringify(data, null, 2), { encoding: 'utf8' });
        try {
          // cleanup tmp if exists
          await fsStat(tmp).then(() => {}).catch(() => {});
        } catch {}
        return data;
      } catch (error) {
        // On fetch error, try to return any existing cache (even stale)
        try {
          const files = await (await import('fs/promises')).readdir(cacheDir);
          // find latest matching host file
          const candidate = files
            .filter(f => f.startsWith(`${hostName}_users_`))
            .sort()
            .pop();
          if (candidate) {
            const text = await readFile(path.join(cacheDir, candidate), { encoding: 'utf8' });
            return JSON.parse(text);
          }
        } catch (e) {
          // ignore
        }
        throw error;
      }
    } catch (err) {
      // If cache setup itself failed, fall back to simple fetch
      try {
        const response = await this.axiosInstance.get(url);
        return response.data;
      } catch (error) {
        throw error;
      }
    }
  }

  public async getDomains() {
    const url = `${this.apiHost}/domains`;

    // Prepare cache: directory and filename per host + hourly bucket
    try {
      const cacheDir = process.env.NUTELLA_CACHE_DIR ?? path.join(process.cwd(), '.cache', 'nutella');
      await mkdir(cacheDir, { recursive: true });

      const hostName = new URL(this.apiHost).hostname.replace(/[:\/\\]/g, '_');
      const now = new Date();
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, '0');
      const d = String(now.getUTCDate()).padStart(2, '0');
      const h = String(now.getUTCHours()).padStart(2, '0');
      const cacheFile = path.join(cacheDir, `${hostName}_domains_${y}${m}${d}T${h}Z.json`);

      // If cache exists and is recent (same hourly file), use it
      try {
        const s = await fsStat(cacheFile);
        const ageMs = Date.now() - s.mtime.getTime();
        if (ageMs < 1000 * 60 * 60) {
          const text = await readFile(cacheFile, { encoding: 'utf8' });
          return JSON.parse(text);
        }
      } catch (err) {
        // cache miss -> continue to fetch
      }

      // Fetch from remote and update cache
      try {
        const response = await this.axiosInstance.get(url);
        const data = response.data;
        // write cache atomically (write to temp then rename)
        const tmp = cacheFile + '.tmp';
        await writeFile(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8' });
        await writeFile(cacheFile, JSON.stringify(data, null, 2), { encoding: 'utf8' });
        try {
          // cleanup tmp if exists
          await fsStat(tmp).then(() => {}).catch(() => {});
        } catch {}
        return data;
      } catch (error) {
        // On fetch error, try to return any existing cache (even stale)
        try {
          const files = await (await import('fs/promises')).readdir(cacheDir);
          // find latest matching host file
          const candidate = files
            .filter(f => f.startsWith(`${hostName}_domains_`))
            .sort()
            .pop();
          if (candidate) {
            const text = await readFile(path.join(cacheDir, candidate), { encoding: 'utf8' });
            return JSON.parse(text);
          }
        } catch (e) {
          // ignore
        }
        throw error;
      }
    } catch (err) {
      // If cache setup itself failed, fall back to simple fetch
      try {
        const response = await this.axiosInstance.get(url);
        return response.data;
      } catch (error) {
        throw error;
      }
    }
  }

  public async downloadFile(url: string, destPath: string): Promise<void> {
    try {
      const response = await this.axiosInstance.get(url, { responseType: 'stream' });
      const writer = createWriteStream(destPath);
      response.data.pipe(writer);
      await new Promise<void>((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? `${error.message}` : 'Unknown error';
      throw new Error(`Failed to download file: ${errorMessage}`);
    }
  }

  public async fetchRemoteFileMetadata(url: string): Promise<RemoteFileMetadata> {
    try {
      const response = await this.axiosInstance.head(url);
      return {
        date: response.headers['date'],
        contentLength: response.headers['content-length'],
      };
    } catch (error) {
      return {};
    }
  }

  public async addReasoningLog(reasoningData: Record<string, any>) {
    const url = `${this.apiHost}/agent/memory/add`;
    try {
      const response = await this.axiosInstance.post(url, reasoningData);
      return response.data;
    } catch (error) {
    }
  }
}