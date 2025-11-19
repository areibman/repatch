type Schema = Record<string, unknown>;

function managedUserSchema(): Schema {
  return {
    type: 'object',
    required: [
      'id',
      'email',
      'role',
      'isActive',
      'metadata',
      'createdAt',
      'updatedAt',
    ],
    properties: {
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string', format: 'email' },
      role: {
        type: 'string',
        enum: ['admin', 'editor', 'viewer'],
      },
      isActive: { type: 'boolean' },
      fullName: { type: ['string', 'null'] },
      avatarUrl: { type: ['string', 'null'], format: 'uri' },
      metadata: { type: ['object', 'null'], additionalProperties: true },
      lastSignInAt: { type: ['string', 'null'], format: 'date-time' },
      createdAt: { type: ['string', 'null'], format: 'date-time' },
      updatedAt: { type: ['string', 'null'], format: 'date-time' },
    },
  };
}

function managedUserListResponse(): Schema {
  return {
    type: 'object',
    required: ['users', 'pagination'],
    properties: {
      users: {
        type: 'array',
        items: { $ref: '#/components/schemas/ManagedUser' },
      },
      pagination: {
        type: 'object',
        required: ['page', 'perPage', 'total'],
        properties: {
          page: { type: 'integer', minimum: 1 },
          perPage: { type: 'integer', minimum: 1 },
          total: { type: 'integer', minimum: 0 },
          nextPage: { type: ['integer', 'null'], minimum: 1 },
          lastPage: { type: ['integer', 'null'], minimum: 1 },
        },
      },
    },
  };
}

function createUserRequestSchema(): Schema {
  return {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: {
        type: 'string',
        minLength: 12,
        maxLength: 72,
        description:
          'Optional password. If omitted, the API returns a temporary password in the response.',
      },
      fullName: { type: 'string', maxLength: 140 },
      avatarUrl: { type: 'string', format: 'uri' },
      role: {
        type: 'string',
        enum: ['admin', 'editor', 'viewer'],
        default: 'viewer',
      },
      metadata: {
        type: 'object',
        additionalProperties: true,
      },
    },
  };
}

function updateUserRequestSchema(): Schema {
  return {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 12, maxLength: 72 },
      fullName: { type: 'string', maxLength: 140 },
      avatarUrl: { type: 'string', format: 'uri' },
      role: {
        type: 'string',
        enum: ['admin', 'editor', 'viewer'],
      },
      isActive: { type: 'boolean' },
      metadata: {
        type: 'object',
        additionalProperties: true,
      },
    },
  };
}

function createUserResponseSchema(): Schema {
  return {
    type: 'object',
    required: ['user'],
    properties: {
      user: { $ref: '#/components/schemas/ManagedUser' },
      temporaryPassword: {
        type: 'string',
        description:
          'Present only when the API auto-generates a password for the user.',
        nullable: true,
      },
    },
  };
}

export function buildUserManagementOpenApiDocument() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return {
    openapi: '3.1.0',
    info: {
      title: 'Repatch User Management API',
      version: '1.0.0',
      description:
        'Internal API for managing Supabase users and profiles. Requires an `x-api-key` header.',
    },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
      },
      schemas: {
        ManagedUser: managedUserSchema(),
        UserListResponse: managedUserListResponse(),
        CreateUserRequest: createUserRequestSchema(),
        UpdateUserRequest: updateUserRequestSchema(),
        CreateUserResponse: createUserResponseSchema(),
        DeleteUserResponse: {
          type: 'object',
          properties: {
            deleted: { type: 'boolean' },
            id: { type: 'string', format: 'uuid' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: {},
          },
        },
      },
    },
    paths: {
      '/api/users': {
        get: {
          tags: ['Users'],
          summary: 'List users',
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', minimum: 1, default: 1 },
            },
            {
              name: 'perPage',
              in: 'query',
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 25,
              },
            },
            {
              name: 'search',
              in: 'query',
              schema: { type: 'string' },
            },
            {
              name: 'role',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['admin', 'editor', 'viewer'],
              },
            },
            {
              name: 'activeOnly',
              in: 'query',
              schema: { type: 'boolean' },
            },
          ],
          responses: {
            200: {
              description: 'Users fetched successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/UserListResponse' },
                },
              },
            },
            401: {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
        post: {
          tags: ['Users'],
          summary: 'Create a user',
          security: [{ ApiKeyAuth: [] }],
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
                  schema: { $ref: '#/components/schemas/CreateUserResponse' },
                },
              },
            },
            400: {
              description: 'Validation error',
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
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        get: {
          tags: ['Users'],
          summary: 'Get a single user',
          security: [{ ApiKeyAuth: [] }],
          responses: {
            200: {
              description: 'User fetched',
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
          tags: ['Users'],
          summary: 'Update a user',
          security: [{ ApiKeyAuth: [] }],
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
              description: 'User updated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ManagedUser' },
                },
              },
            },
            400: {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
        delete: {
          tags: ['Users'],
          summary: 'Delete a user',
          security: [{ ApiKeyAuth: [] }],
          responses: {
            200: {
              description: 'User deleted',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DeleteUserResponse' },
                },
              },
            },
          },
        },
      },
    },
  } as const;
}

