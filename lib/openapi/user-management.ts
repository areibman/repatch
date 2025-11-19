interface OpenApiPath {
  [method: string]: {
    summary: string;
    description?: string;
    tags: string[];
    security?: Array<Record<string, string[]>>;
    parameters?: Array<Record<string, unknown>>;
    requestBody?: Record<string, unknown>;
    responses: Record<string, unknown>;
  };
}

export interface OpenApiDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string }>;
  components: Record<string, unknown>;
  paths: Record<string, OpenApiPath>;
}

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: ['string', 'null'], format: 'email' },
    fullName: { type: ['string', 'null'] },
    avatarUrl: { type: ['string', 'null'], format: 'uri' },
    role: { type: 'string', enum: ['admin', 'manager', 'editor', 'viewer', 'service'] },
    status: { type: 'string', enum: ['invited', 'active', 'suspended', 'deactivated'] },
    metadata: { type: ['object', 'null'] },
    lastSignInAt: { type: ['string', 'null'], format: 'date-time' },
    emailConfirmedAt: { type: ['string', 'null'], format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'role', 'status', 'metadata', 'createdAt', 'updatedAt'],
};

const tokenSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    expiresAt: { type: ['string', 'null'], format: 'date-time' },
    lastUsedAt: { type: ['string', 'null'], format: 'date-time' },
    revokedAt: { type: ['string', 'null'], format: 'date-time' },
    metadata: { type: ['object', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'name', 'createdAt'],
};

const serviceErrorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
  required: ['error'],
};

const security = [{ bearerAuth: [] }];

function buildPaths(): Record<string, OpenApiPath> {
  const paths: Record<string, OpenApiPath> = {};

  paths['/api/users'] = {
    get: {
      summary: 'List users',
      description: 'Fetches paginated user profiles with optional filtering.',
      tags: ['Users'],
      security,
      parameters: [
        {
          name: 'search',
          in: 'query',
          schema: { type: 'string' },
          description: 'Filter by email or full name substring',
        },
        {
          name: 'role',
          in: 'query',
          schema: { type: 'string', enum: userSchema.properties.role.enum },
          description: 'Repeatable role filter',
        },
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: userSchema.properties.status.enum },
          description: 'Repeatable status filter',
        },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
        { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } },
      ],
      responses: {
        200: {
          description: 'Users retrieved.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { type: 'array', items: userSchema },
                  total: { type: 'integer' },
                  limit: { type: 'integer' },
                  offset: { type: 'integer' },
                },
                required: ['data', 'total', 'limit', 'offset'],
              },
            },
          },
        },
        401: { description: 'Unauthorized', content: { 'application/json': { schema: serviceErrorSchema } } },
      },
    },
    post: {
      summary: 'Create user',
      description: 'Creates a Supabase auth user and associated profile.',
      tags: ['Users'],
      security,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 8 },
                fullName: { type: 'string' },
                avatarUrl: { type: 'string', format: 'uri' },
                role: { type: 'string', enum: userSchema.properties.role.enum },
                status: { type: 'string', enum: userSchema.properties.status.enum },
                metadata: { type: 'object' },
                sendWelcomeEmail: { type: 'boolean', default: false },
              },
              required: ['email'],
            },
          },
        },
      },
      responses: {
        201: {
          description: 'User created.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  user: userSchema,
                  temporaryPassword: { type: 'string' },
                },
                required: ['user'],
              },
            },
          },
        },
        400: { description: 'Validation or auth error', content: { 'application/json': { schema: serviceErrorSchema } } },
        401: { description: 'Unauthorized', content: { 'application/json': { schema: serviceErrorSchema } } },
      },
    },
  };

  paths['/api/users/{id}'] = {
    get: {
      summary: 'Get user',
      tags: ['Users'],
      security,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        200: {
          description: 'User retrieved.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                allOf: [
                  userSchema,
                  {
                    type: 'object',
                    properties: {
                      tokens: { type: 'array', items: tokenSchema },
                    },
                    required: ['tokens'],
                  },
                ],
              },
            },
          },
        },
        404: { description: 'User not found', content: { 'application/json': { schema: serviceErrorSchema } } },
      },
    },
    patch: {
      summary: 'Update user',
      tags: ['Users'],
      security,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email' },
                fullName: { type: ['string', 'null'] },
                avatarUrl: { type: ['string', 'null'], format: 'uri' },
                role: { type: 'string', enum: userSchema.properties.role.enum },
                status: { type: 'string', enum: userSchema.properties.status.enum },
                metadata: { type: 'object' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'User updated.',
          content: { 'application/json': { schema: userSchema } },
        },
        400: { description: 'Validation error', content: { 'application/json': { schema: serviceErrorSchema } } },
        404: { description: 'User not found', content: { 'application/json': { schema: serviceErrorSchema } } },
      },
    },
    delete: {
      summary: 'Deactivate user',
      tags: ['Users'],
      security,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        200: { description: 'User deactivated.', content: { 'application/json': { schema: userSchema } } },
        404: { description: 'User not found', content: { 'application/json': { schema: serviceErrorSchema } } },
      },
    },
  };

  paths['/api/users/{id}/tokens'] = {
    post: {
      summary: 'Create API token',
      tags: ['User Tokens'],
      security,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                expiresAt: { type: 'string', format: 'date-time' },
                metadata: { type: 'object' },
              },
              required: ['name'],
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Token created.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  tokenId: { type: 'string', format: 'uuid' },
                  token: { type: 'string' },
                  name: { type: 'string' },
                  expiresAt: { type: ['string', 'null'], format: 'date-time' },
                },
                required: ['tokenId', 'token', 'name'],
              },
            },
          },
        },
        404: { description: 'User not found', content: { 'application/json': { schema: serviceErrorSchema } } },
      },
    },
  };

  paths['/api/users/{id}/tokens/{tokenId}'] = {
    delete: {
      summary: 'Revoke API token',
      tags: ['User Tokens'],
      security,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        { name: 'tokenId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        200: { description: 'Token revoked.', content: { 'application/json': { schema: tokenSchema } } },
        404: { description: 'Token not found', content: { 'application/json': { schema: serviceErrorSchema } } },
      },
    },
  };

  return paths;
}

export function buildUserManagementSpec(baseUrl: string): OpenApiDocument {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Repatch User Management API',
      version: '1.0.0',
      description:
        'User management endpoints backed by Supabase Auth that power both the dashboard UI and future MCP (Model Context Protocol) integrations.',
    },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: userSchema,
        UserToken: tokenSchema,
        ErrorResponse: serviceErrorSchema,
      },
    },
    paths: buildPaths(),
  };
}
