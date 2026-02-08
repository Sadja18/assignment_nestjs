import { Injectable } from '@nestjs/common';

/**
 * Root application service (currently minimal).
 * 
 * NOTE: This service exists only to support the default / endpoint.
 * Will be REMOVED before final submission since assignment doesn't require it.
 */
@Injectable()
export class AppService {
  getHello(): string {
    return 'Currency Rate Service - Assignment Ready!';
  }
}