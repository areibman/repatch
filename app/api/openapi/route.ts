import { NextResponse } from 'next/server';

import { USER_ROLE_OPTIONS, USER_STATUS_OPTIONS } from '@/types/user';

const serverUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Repatch Admin API',
    version: '1.0.0',
    description:
      'API surface area for managing Repatch resources. These endpoints mirror internal Supabase user management workflows and are designed to be OpenAPI/MCP compatible.',
  },
  servers: [
    {
      url: serverUrl,
    },
  ],
  paths: {
    '/api/users': {
      get: {
        summary: 'List users',
        description:
          'Returns a paginated list of Supabase Auth users merged with profile metadata stored in the `user_profiles` table.',
        tags: ['Users'],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', minimum: 1, default: 1 },
          },
          {
            name: 'perPage',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
          {
            name: 'email',
            in: 'query',
            schema: { type: 'string', format: 'email' },
          },
          {
            name: 'role',
            in: 'query',
            schema: { type: 'string', enum: USER_ROLE_OPTIONS },
          },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: USER_STATUS_OPTIONS },
          },
        ],
        responses: {
          200: {
            description: 'Paginated list of users',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaginatedUsersResponse' },
              },
            },
          },
          500: {
            description: 'Unexpected server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create or invite a user',
        description:
          'Creates a Supabase Auth user (with optional password) and ensures a matching `user_profiles` record exists.',
        tags: ['Users'],
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
            description: 'User created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ManagedUser' },
              },
            },
          },
          400: {
            description: 'Invalid request body',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          500: {
            description: 'Unexpected server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/users/{id}': {
      get: {
        summary: 'Get user details',
        tags: ['Users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'User record',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ManagedUser' },
              },
            },
          },
          404: {
            description: 'User not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      patch: {
        summary: 'Update a user',
        tags: ['Users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
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
            description: 'Updated user record',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ManagedUser' },
              },
            },
          },
          400: {
            description: 'Invalid payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          404: {
            description: 'User not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      delete: {
        summary: 'Delete a user',
        tags: ['Users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          204: {
            description: 'User deleted',
          },
          404: {
            description: 'User not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ManagedUser: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email', nullable: true },
          role: { type: 'string', enum: USER_ROLE_OPTIONS },
          status: { type: 'string', enum: USER_STATUS_OPTIONS },
          fullName: { type: 'string', nullable: true },
          avatarUrl: { type: 'string', format: 'uri', nullable: true },
          metadata: { type: 'object', additionalProperties: true },
          lastSignInAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time', nullable: true },
          factors: { type: 'array', items: { type: 'object', additionalProperties: true } },
          provider: { type: 'string', nullable: true },
        },
        required: ['id', 'role', 'status', 'metadata', 'createdAt', 'factors'],
      },
      PaginatedUsersResponse: {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            items: { $ref: '#/components/schemas/ManagedUser' },
          },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              perPage: { type: 'integer' },
              total: { type: 'integer' },
            },
            required: ['page', 'perPage', 'total'],
          },
        },
        required: ['users', 'pagination'],
      },
      CreateUserRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: {
            type: 'string',
            minLength: 8,
            description: 'Required when `sendInvite` is false.',
          },
          sendInvite: {
            type: 'boolean',
            default: true,
            description: 'If true, the user receives an invite email instead of a password being required.',
          },
          fullName: { type: 'string' },
          avatarUrl: { type: 'string', format: 'uri' },
          role: { type: 'string', enum: USER_ROLE_OPTIONS, default: 'viewer' },
          status: { type: 'string', enum: USER_STATUS_OPTIONS, default: 'invited' },
          metadata: { type: 'object', additionalProperties: true },
        },
        required: ['email'],
      },
      UpdateUserRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          fullName: { type: 'string' },
          avatarUrl: { type: 'string', format: 'uri' },
          role: { type: 'string', enum: USER_ROLE_OPTIONS },
          status: { type: 'string', enum: USER_STATUS_OPTIONS },
          metadata: { type: 'object', additionalProperties: true },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          details: { type: 'object', additionalProperties: true },
        },
        required: ['error'],
      },
    },
  },
};

export function GET() {
  return NextResponse.json(openApiDocument, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
