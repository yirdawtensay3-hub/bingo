import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { readFileSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  const httpsOptions =
    process.env.NODE_ENV !== 'dev' || ''
      ? undefined
      : {
          key: readFileSync(join(__dirname, '..', 'secrets', 'key.pem')),
          cert: readFileSync(join(__dirname, '..', 'secrets', 'cert.pem')),
        };

  const app = await NestFactory.create(AppModule, {
    httpsOptions,
  });

  app.enableCors({
    origin: process.env.ORIGIN || 'https://goatbingo.pro.et',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Backend running on https://localhost:3000`);
}
bootstrap();
