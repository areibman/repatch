import { NextResponse } from 'next/server';

const noStoreHeaders = {
  'Cache-Control': 'no-store',
};

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'User Management API',
    version: '1.0.0',
    description:
      'OpenAPI description for the Supabase-backed user management endpoints. The schema follows the Supabase user/profile pattern outlined in https://supabase.com/docs/guides/auth/managing-user-data.',
  },
  servers: [
    {
      url: '/api',
      description: 'Current deployment',
    },
  ],
  tags: [
    {
      name: 'Users',
      description: 'Manage Supabase auth users and profile metadata',
    },
  ],
  paths: {
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'List users',
        description: 'Returns a paginated list of Supabase auth users.',
        security: [{ InternalApiKey: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', minimum: 1, default: 1 },
            description: 'Page number (1-indexed).',
          },
          {
            name: 'perPage',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            description: 'Number of items per page.',
          },
          {
            name: 'query',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by email, full name, or role.',
          },
          {
            name: 'includeInvited',
            in: 'query',
            schema: { type: 'boolean', default: true },
            description: 'Include users who have not confirmed their email.',
          },
          {
            name: 'includeBanned',
            in: 'query',
            schema: { type: 'boolean', default: true },
            description: 'Include currently banned users.',
          },
        ],
        responses: {
          200: {
            description: 'List response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserListResponse' },
              },
            },
          },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create or invite a user',
        description:
          'Creates a Supabase auth user or sends an invite email, then syncs the public profile record.',
        security: [{ InternalApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateUserRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'User created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ManagedUser' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequestError' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          409: {
            description: 'Conflict',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          500: { $ref: '#/components/responses/InternalServerError' },
        },
      },
    },
    '/users/{userId}': {
      parameters: [
        {
          name: 'userId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      get: {
        tags: ['Users'],
        summary: 'Get user',
        security: [{ InternalApiKey: [] }],
        responses: {
          200: {
            description: 'User details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ManagedUser' },
              },
            },
          },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' },
        },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update user',
        security: [{ InternalApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateUserRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Updated user',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ManagedUser' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequestError' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete user',
        security: [{ InternalApiKey: [] }],
        parameters: [
          {
            name: 'soft',
            in: 'query',
            schema: { type: 'boolean', default: false },
            description: 'Perform a soft delete (default false).',
          },
        ],
        responses: {
          200: {
            description: 'Delete acknowledgement',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DeleteUserResponse' },
              },
            },
          },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      InternalApiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      },
    },
    responses: {
      BadRequestError: {
        description: 'Invalid input',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      UnauthorizedError: {
        description: 'Missing or invalid API key',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      NotFoundError: {
        description: 'Entity not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      InternalServerError: {
        description: 'Unexpected error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    },
    schemas: {
      UserRole: {
        type: 'string',
        enum: ['admin', 'editor', 'viewer'],
      },
      UserProfile: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          full_name: { type: 'string', nullable: true },
          avatar_url: { type: 'string', nullable: true },
          role: { $ref: '#/components/schemas/UserRole' },
          metadata: { type: 'object', additionalProperties: true, nullable: true },
          preferences: {
            type: 'object',
            additionalProperties: true,
            nullable: true,
          },
          last_sign_in_at: { type: 'string', format: 'date-time', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      ManagedUser: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          fullName: { type: 'string', nullable: true },
          avatarUrl: { type: 'string', nullable: true },
          role: { $ref: '#/components/schemas/UserRole' },
          status: {
            type: 'string',
            enum: ['active', 'invited', 'banned'],
          },
          bannedUntil: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time', nullable: true },
          lastSignInAt: { type: 'string', format: 'date-time', nullable: true },
          metadata: {
            type: 'object',
            additionalProperties: true,
            nullable: true,
          },
          preferences: {
            type: 'object',
            additionalProperties: true,
            nullable: true,
          },
          factors: {
            type: 'array',
            items: { type: 'string' },
          },
          profile: {
            $ref: '#/components/schemas/UserProfile',
            nullable: true,
          },
        },
        required: [
          'id',
          'email',
          'role',
          'status',
          'createdAt',
          'factors',
        ],
      },
      UserListResponse: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/ManagedUser' },
          },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              perPage: { type: 'integer' },
              total: { type: 'integer' },
              totalPages: { type: 'integer' },
              nextPage: { type: 'integer', nullable: true },
              hasMore: { type: 'boolean' },
            },
          },
          filters: {
            type: 'object',
            properties: {
              query: { type: 'string', nullable: true },
              includeInvited: { type: 'boolean' },
              includeBanned: { type: 'boolean' },
            },
          },
        },
      },
      CreateUserRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          fullName: { type: 'string' },
          avatarUrl: { type: 'string' },
          role: { $ref: '#/components/schemas/UserRole' },
          metadata: {
            type: 'object',
            additionalProperties: true,
          },
          preferences: {
            type: 'object',
            additionalProperties: true,
          },
          invite: { type: 'boolean', default: false },
          emailConfirmed: { type: 'boolean', default: false },
          redirectTo: { type: 'string' },
        },
        required: ['email'],
      },
      UpdateUserRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          fullName: { type: 'string' },
          avatarUrl: { type: 'string' },
          role: { $ref: '#/components/schemas/UserRole' },
          metadata: {
            type: 'object',
            additionalProperties: true,
          },
          preferences: {
            type: 'object',
            additionalProperties: true,
          },
          banDuration: {
            type: 'string',
            description:
              "Duration string accepted by Supabase (e.g. '2h', '30m', 'none').",
          },
        },
      },
      DeleteUserResponse: {
        type: 'object',
        properties: {
          deleted: { type: 'boolean' },
          soft: { type: 'boolean' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          issues: {
            type: 'object',
            additionalProperties: true,
            nullable: true,
          },
        },
        required: ['error'],
      },
    },
  },
} as const;

export function GET() {
  return NextResponse.json(spec, {
    status: 200,
    headers: noStoreHeaders,
  });
}
