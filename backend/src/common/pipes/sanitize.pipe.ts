import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class SanitizePipe implements PipeTransform {
  private static readonly TAG_RE = /<[^>]*>/g;

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== 'body') {
      return value;
    }
    return this.sanitizeDeep(value);
  }

  private sanitizeDeep(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.replace(SanitizePipe.TAG_RE, '');
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeDeep(item));
    }
    if (
      value !== null &&
      typeof value === 'object' &&
      !Buffer.isBuffer(value)
    ) {
      const out: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(value)) {
        out[key] = this.sanitizeDeep(v);
      }
      return out;
    }
    return value;
  }
}
