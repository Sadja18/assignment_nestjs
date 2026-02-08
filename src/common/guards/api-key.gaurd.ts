import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    private readonly apiKey = process.env.API_KEY;

    canActivate(context: ExecutionContext): boolean {
        // Skip auth for health check (required for AWS/App Runner)
        const request = context.switchToHttp().getRequest();
        if (request.url === '/health') {
            return true;
        }

        // Require API key for all other endpoints
        const key = request.headers['x-api-key'] || request.query.api_key;

        if (!this.apiKey) {
            // Fail closed if no key configured (safer than open access)
            throw new UnauthorizedException('API key not configured');
        }

        if (key !== this.apiKey) {
            throw new UnauthorizedException('Invalid or missing API key');
        }

        return true;
    }
}