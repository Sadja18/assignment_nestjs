import { Logger } from '@nestjs/common';

export class StructuredLogger {
    private readonly logger = new Logger();

    log(message: string, context?: string, meta?: Record<string, any>) {
        const logEntry = meta ? `${message} | ${JSON.stringify(meta)}` : message;
        this.logger.log(logEntry, context);
    }

    error(message: string, context?: string, trace?: string, meta?: Record<string, any>) {
        const logEntry = meta ? `${message} | ${JSON.stringify(meta)}` : message;
        this.logger.error(logEntry, trace, context);
    }

    warn(message: string, context?: string, meta?: Record<string, any>) {
        const logEntry = meta ? `${message} | ${JSON.stringify(meta)}` : message;
        this.logger.warn(logEntry, context);
    }

    debug(message: string, context?: string, meta?: Record<string, any>) {
        const logEntry = meta ? `${message} | ${JSON.stringify(meta)}` : message;
        this.logger.debug(logEntry, context);
    }
}