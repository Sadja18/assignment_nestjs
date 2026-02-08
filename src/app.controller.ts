import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Root application endpoints providing system-level functionality.
 * 
 * OBSERVABILITY REQUIREMENTS (per assignment):
 * - Health check endpoint at /health
 * - Returns machine-readable status for monitoring systems
 * - Includes timestamp for freshness validation
 * 
 * FUTURE ENHANCEMENTS:
 * - Will add /health/details with DB/API dependency checks
 * - Will integrate with Prometheus metrics endpoint
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  /**
   * Default welcome endpoint (development convenience).
   * NOT required by assignment - will be removed before final submission.
   */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * REQUIRED HEALTH CHECK ENDPOINT (per assignment section 6).
   * 
   * PURPOSE:
   * - Allows load balancers/monitoring systems to verify service availability
   * - Returns 200 OK when service is operational
   * - Includes ISO8601 timestamp for uptime tracking
   * 
   * PRODUCTION READINESS:
   * - Currently basic implementation
   * - Will be enhanced to check critical dependencies (DB, Frankfurter API)
   */
  @SkipThrottle()
  @Get('health')
  getHealth() {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      // Future: Add version, uptime, dependency statuses
    };
  }
}