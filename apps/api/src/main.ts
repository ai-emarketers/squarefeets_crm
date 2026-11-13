// API entry point: creates the Nest app, configures it and starts listening.
import 'reflect-metadata'; // required by Nest's decorators / dependency injection
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

// Create the Nest app, apply global settings (prefix, CORS, validation) and start listening.
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Every route lives under /api (e.g. /api/auth/login).
  app.setGlobalPrefix('api');
  // Allow the Next.js site (WEB_ORIGIN, comma separated) to call the API from the browser.
  app.enableCors({ origin: (process.env.WEB_ORIGIN || 'http://localhost:3000').split(','), credentials: true });
  // Validate DTO classes (class-validator); whitelist is off because records carry free-form fields.
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));
  // Records (deals with offers, documents metadata …) can be large JSON bodies.
  app.useBodyParser('json', { limit: '25mb' });
  // Hosting platforms (Railway, Render, Heroku …) tell the app its port through PORT; locally API_PORT / 4000 is used.
  const port = Number(process.env.PORT || process.env.API_PORT || 4000);
  // API_HOST: '0.0.0.0' by default; Railway's private network needs '::' (set in apps/api/railway.json).
  await app.listen(port, process.env.API_HOST || '0.0.0.0');
  console.log(`SquareFeets CRM API running on http://localhost:${port}/api`);
}
bootstrap();
