import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function forcePathStyleForEndpoint(endpoint: string): boolean {
  const ep = endpoint.toLowerCase();
  if (ep.includes('localhost') || ep.includes('minio')) {
    return true;
  }
  try {
    const u = new URL(endpoint);
    // MinIO / S3 custom sur IP LAN : style « path » en général requis
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname)) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  /** Opérations serveur (upload, delete, head) — souvent localhost / réseau Docker. */
  private readonly client: S3Client;
  /**
   * URLs présignées pour les clients (navigateur, app mobile).
   * Si `S3_PUBLIC_ENDPOINT` est défini, les signatures utilisent cette base (ex. IP LAN pour MinIO).
   */
  private readonly signingClient: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.getOrThrow<string>('S3_ENDPOINT');
    const region = this.config.getOrThrow<string>('S3_REGION');
    const accessKeyId = this.config.getOrThrow<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.config.getOrThrow<string>('S3_SECRET_KEY');
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');

    const publicEp = this.config.get<string>('S3_PUBLIC_ENDPOINT')?.trim();
    const signingEndpoint =
      publicEp && publicEp.length > 0 ? publicEp : endpoint;

    const credentials = { accessKeyId, secretAccessKey };

    this.client = new S3Client({
      region,
      endpoint,
      credentials,
      forcePathStyle: forcePathStyleForEndpoint(endpoint),
    });

    this.signingClient =
      signingEndpoint === endpoint
        ? this.client
        : new S3Client({
            region,
            endpoint: signingEndpoint,
            credentials,
            forcePathStyle: forcePathStyleForEndpoint(signingEndpoint),
          });

    if (this.signingClient !== this.client) {
      this.logger.log(
        `S3 : présignation avec endpoint public « ${signingEndpoint} » (S3_PUBLIC_ENDPOINT).`,
      );
    }
  }

  async onModuleInit(): Promise<void> {
    const raw = this.config.get<string>('S3_ENSURE_BUCKET', '')?.trim();
    if (raw !== 'true' && raw !== '1') {
      return;
    }
    await this.ensureBucketExists();
  }

  /** Si `S3_ENSURE_BUCKET=true`, crée le bucket MinIO/S3 au besoin (pratique en local). */
  private async ensureBucketExists(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return;
    } catch {
      /* bucket absent ou inaccessible */
    }
    try {
      await this.client.send(
        new CreateBucketCommand({
          Bucket: this.bucket,
        }),
      );
      this.logger.log(`Bucket S3 « ${this.bucket} » créé (S3_ENSURE_BUCKET).`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `S3_ENSURE_BUCKET : impossible de créer le bucket « ${this.bucket} » : ${msg}`,
      );
    }
  }

  async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return key;
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.signingClient, cmd, { expiresIn });
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  /** Vérifie que le bucket S3/MinIO est joignable (health check). */
  async pingBucket(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  buildPayslipKey(
    companyId: string,
    userId: string,
    year: number,
    month: number,
  ): string {
    const m = month.toString().padStart(2, '0');
    return `companies/${companyId}/payslips/${userId}/${year}/${m}.pdf`;
  }
}
