import { registerAs } from '@nestjs/config';
import * as pgConnectionString from 'pg-connection-string';

export default registerAs('database', () => {
    const connectionString = process.env.PSQL_CONNECT;

    if (!connectionString) {
        throw new Error('PSQL_CONNECT environment variable is required');
    }

    // Parse PostgreSQL connection string into TypeORM config
    const parsed = pgConnectionString.parse(connectionString);

    return {
        type: 'postgres',
        host: parsed.host,
        port: parsed.port ? parseInt(parsed.port, 10) : 5432,
        username: parsed.user,
        password: parsed.password,
        database: parsed.database,
        ssl: parsed.ssl !== undefined ? parsed.ssl : true, // Neon requires SSL
        synchronize: true, // Disable in production!
        logging: process.env.NODE_ENV === 'development',
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    };
});