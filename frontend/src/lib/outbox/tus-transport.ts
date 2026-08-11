/**
 * Real transport: Notes via plain REST, media via plone.restapi's built-in
 * TUS support (@tus-upload) with resume, then a PATCH for the travel
 * metadata (captured_at, coordinates, title).
 */

import * as tus from 'tus-js-client';

import type { ApiClient } from '../api/client';
import { ApiError } from '../api/client';
import { TransportError, type OutboxTransport, type TransportResult, type UploadCallbacks } from './transport';
import { TYPE_FOR_KIND, type OutboxItem } from './types';

/**
 * The backend answers TUS creation with an absolute Location built from its
 * own virtual-host view (e.g. http://host/trips/...), which bypasses the
 * same-origin /++api++ proxy and fails CORS when the public port differs.
 * Route every TUS request URL through api.resolve() so PATCH/HEAD/DELETE
 * always hit the proxy, whatever origin the server claims. This also heals
 * upload URLs persisted in the outbox by older app versions.
 */
class ProxyHttpStack implements tus.HttpStack {
  private inner = new tus.DefaultHttpStack({});

  constructor(private api: ApiClient) {}

  createRequest(method: string, url: string): tus.HttpRequest {
    return this.inner.createRequest(method, this.api.resolve(url));
  }

  getName(): string {
    return 'ProxyHttpStack';
  }
}

/**
 * All trips live in the site's /trips folder. Items queued by older app
 * versions stored the trip path without that prefix (a contentPath bug
 * behind the virtual-host proxy); heal them here so a stale outbox or a
 * remembered last-trip still uploads to the right container.
 */
function tripContainerPath(tripPath: string): string {
  return tripPath === 'trips' || tripPath.startsWith('trips/')
    ? tripPath
    : `trips/${tripPath}`;
}

export class TusTransport implements OutboxTransport {
  constructor(private api: ApiClient) {}

  async createNote(item: OutboxItem): Promise<TransportResult> {
    try {
      const created = await this.api.post<{ '@id': string }>(`/${tripContainerPath(item.tripPath)}`, {
        '@type': TYPE_FOR_KIND.note,
        title: item.title,
        text: item.text ?? '',
        captured_at: item.capturedAt,
        latitude: item.latitude,
        longitude: item.longitude
      });
      return { remoteUrl: created['@id'] };
    } catch (error) {
      if (error instanceof ApiError) {
        throw new TransportError(
          `Note creation failed (${error.status})`,
          error.status >= 400 && error.status < 500 && error.status !== 401
        );
      }
      throw new TransportError(String(error));
    }
  }

  uploadMedia(item: OutboxItem, callbacks: UploadCallbacks): Promise<TransportResult> {
    const blob = item.blob;
    if (!blob) {
      return Promise.reject(new TransportError('No file attached yet', true));
    }
    const endpoint = this.api.resolve(`/${tripContainerPath(item.tripPath)}/@tus-upload`);

    return new Promise<TransportResult>((resolve, reject) => {
      // plone.restapi answers the final PATCH with a Location header
      // pointing at the created content - remember it so finalize() does
      // not need to probe the consumed upload URL (which 404s).
      let createdLocation: string | null = null;
      const upload = new tus.Upload(blob, {
        endpoint,
        uploadUrl: item.uploadUrl ?? undefined,
        metadata: {
          filename: item.filename ?? 'capture',
          'content-type': item.contentType ?? 'application/octet-stream',
          '@type': TYPE_FOR_KIND[item.kind]
        },
        headers: this.api.authHeaders(),
        httpStack: new ProxyHttpStack(this.api),
        chunkSize: 5 * 1024 * 1024,
        retryDelays: null, // the outbox owns retry/backoff policy
        onProgress: (sent, total) => {
          callbacks.onProgress?.(total ? sent / total : 0);
        },
        onAfterResponse: (req, res) => {
          const url = upload.url;
          if (url) callbacks.onUploadUrl?.(url);
          const location = res.getHeader('Location');
          if (location && req.getMethod().toUpperCase() === 'PATCH') {
            createdLocation = location;
          }
        },
        onSuccess: async () => {
          try {
            const location =
              upload.url == null && createdLocation == null
                ? null
                : await this.finalize(item, upload.url, createdLocation);
            resolve({ remoteUrl: location ?? item.tripPath });
          } catch (error) {
            reject(
              error instanceof TransportError
                ? error
                : new TransportError(String(error))
            );
          }
        },
        onError: (error) => {
          const status =
            'originalResponse' in error && error.originalResponse
              ? error.originalResponse.getStatus()
              : 0;
          reject(
            new TransportError(
              error.message,
              status >= 400 && status < 500 && status !== 401 && status !== 0
            )
          );
        }
      });

      // Resume a previous partial upload when the server still knows it.
      void upload.findPreviousUploads().then((previous) => {
        if (!item.uploadUrl && previous.length > 0) {
          upload.resumeFromPreviousUpload(previous[0]);
        }
        upload.start();
      });
    });
  }

  /**
   * The TUS HEAD/PATCH cycle ends with the created content's location in
   * the final response; plone.restapi redirects the finished upload to the
   * new object. Fetch it, then PATCH the travel metadata onto it.
   */
  private async finalize(
    item: OutboxItem,
    tusUrl: string | null,
    createdLocation: string | null
  ): Promise<string> {
    // Preferred: the Location header of the final PATCH names the created
    // object directly. Probing the upload URL afterwards is only a legacy
    // fallback - it 404s once the upload is consumed.
    let remoteUrl: string | null = createdLocation;
    if (!remoteUrl && tusUrl) {
      try {
        const info = await this.api.get<{ '@id'?: string; url?: string }>(tusUrl);
        remoteUrl = info['@id'] ?? info.url ?? null;
      } catch {
        remoteUrl = null;
      }
    }
    if (!remoteUrl) {
      // Last resort: newest item *created by this user* in the trip (via
      // @search, which honors sorting - a plain folder GET does not), so a
      // partner uploading concurrently can never receive our metadata.
      const creator = this.api.currentUserId();
      const creatorFilter = creator ? `&Creator=${encodeURIComponent(creator)}` : '';
      const listing = await this.api.get<{
        items: { '@id': string; created?: string }[];
      }>(
        `/${tripContainerPath(item.tripPath)}/@search?b_size=1&sort_on=created&sort_order=descending${creatorFilter}`
      );
      remoteUrl = listing.items?.[0]?.['@id'] ?? null;
    }
    if (!remoteUrl) {
      throw new TransportError('Upload finished but created object not found');
    }
    await this.api.patch(remoteUrl, {
      title: item.title,
      captured_at: item.capturedAt,
      latitude: item.latitude,
      longitude: item.longitude
    });
    return remoteUrl;
  }
}
