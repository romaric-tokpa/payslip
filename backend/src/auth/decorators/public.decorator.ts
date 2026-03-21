import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Route accessible sans Bearer JWT (contourne le JwtAuthGuard global). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
