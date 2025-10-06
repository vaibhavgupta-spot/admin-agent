import axios, { AxiosInstance } from 'axios';
import { createWriteStream } from 'fs';

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
  constructor(apiHost: string, hsCsrfToken?: string, authToken?: string, cookies: Record<string, string> = {}) {
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

    if (hsCsrfToken) {
      headers['hs-csrf'] = hsCsrfToken;
    }

    this.axiosInstance = axios.create({
      headers,
      withCredentials: true,
    });
  }

  public async getUsers() {
    const url = `${this.apiHost}/users`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data;
    } catch (error) {
      throw error;
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