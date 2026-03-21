import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './storage.service';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn().mockImplementation((input: object) => input),
  GetObjectCommand: jest.fn().mockImplementation((input: object) => input),
  DeleteObjectCommand: jest.fn().mockImplementation((input: object) => input),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe('StorageService', () => {
  let service: StorageService;
  let sendMock: jest.Mock;

  const configMock = {
    getOrThrow: jest.fn((key: string) => {
      const env: Record<string, string> = {
        S3_ENDPOINT: 'http://localhost:9000',
        S3_REGION: 'us-east-1',
        S3_ACCESS_KEY: 'ak',
        S3_SECRET_KEY: 'sk',
        S3_BUCKET: 'test-bucket',
      };
      return env[key];
    }),
  };

  beforeEach(async () => {
    sendMock = jest.fn().mockResolvedValue({});
    (S3Client as unknown as jest.Mock).mockImplementation(() => ({
      send: sendMock,
    }));
    jest
      .mocked(getSignedUrl)
      .mockResolvedValue('https://presigned.example/url');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get(StorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('initialise S3Client avec forcePathStyle pour localhost', () => {
    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://localhost:9000',
        region: 'us-east-1',
        forcePathStyle: true,
        credentials: { accessKeyId: 'ak', secretAccessKey: 'sk' },
      }),
    );
  });

  describe('uploadFile', () => {
    it('envoie PutObjectCommand et retourne la clé', async () => {
      const buf = Buffer.from('pdf');
      const key = await service.uploadFile(buf, 'a/b.pdf', 'application/pdf');

      expect(key).toBe('a/b.pdf');
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'a/b.pdf',
        Body: buf,
        ContentType: 'application/pdf',
      });
    });

    it('propage une erreur S3', async () => {
      sendMock.mockRejectedValueOnce(new Error('S3 indisponible'));
      await expect(
        service.uploadFile(Buffer.from('x'), 'k', 'application/pdf'),
      ).rejects.toThrow('S3 indisponible');
    });
  });

  it('getPresignedUrl appelle getSignedUrl avec GetObjectCommand', async () => {
    const url = await service.getPresignedUrl('path/key.pdf', 7200);
    expect(url).toBe('https://presigned.example/url');
    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'path/key.pdf',
    });
    expect(getSignedUrl).toHaveBeenCalled();
  });

  it('deleteFile envoie DeleteObjectCommand', async () => {
    await service.deleteFile('to/delete.pdf');
    expect(DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'to/delete.pdf',
    });
    expect(sendMock).toHaveBeenCalled();
  });

  describe('buildPayslipKey', () => {
    it('forme le chemin avec mois sur 2 chiffres', () => {
      expect(service.buildPayslipKey('co-1', 'user-2', 2026, 3)).toBe(
        'companies/co-1/payslips/user-2/2026/03.pdf',
      );
      expect(service.buildPayslipKey('co-1', 'user-2', 2026, 12)).toBe(
        'companies/co-1/payslips/user-2/2026/12.pdf',
      );
    });
  });

  it('forcePathStyle si endpoint contient minio (hors localhost)', async () => {
    jest.clearAllMocks();
    (S3Client as unknown as jest.Mock).mockImplementation(() => ({
      send: jest.fn(),
    }));

    const config = {
      getOrThrow: jest.fn((key: string) => {
        const env: Record<string, string> = {
          S3_ENDPOINT: 'https://minio.example.com',
          S3_REGION: 'eu-west-1',
          S3_ACCESS_KEY: 'k',
          S3_SECRET_KEY: 's',
          S3_BUCKET: 'b',
        };
        return env[key];
      }),
    };

    const module = await Test.createTestingModule({
      providers: [StorageService, { provide: ConfigService, useValue: config }],
    }).compile();

    module.get(StorageService);

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({ forcePathStyle: true }),
    );
  });
});
