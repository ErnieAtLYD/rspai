# TypeScript Advanced Patterns

## Course Overview
**Course**: Advanced TypeScript Patterns  
**Platform**: Frontend Masters  
**Instructor**: Mike North  
**Progress**: 3/8 modules completed  
**Started**: January 10, 2024

## Module 1: Conditional Types

### Key Concepts
Conditional types allow you to create types that depend on a condition, similar to ternary operators but for types.

```typescript
type IsString<T> = T extends string ? true : false;

type Test1 = IsString<string>; // true
type Test2 = IsString<number>; // false
```

### Practical Example: API Response Types
```typescript
type ApiResponse<T> = T extends string 
  ? { message: T; status: 'success' }
  : { data: T; status: 'success' };

type StringResponse = ApiResponse<string>;
// { message: string; status: 'success' }

type UserResponse = ApiResponse<User>;
// { data: User; status: 'success' }
```

### Use Cases
- Creating flexible utility types
- Building type-safe APIs
- Conditional property inclusion

## Module 2: Mapped Types

### Basic Mapped Types
Transform existing types by mapping over their properties.

```typescript
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

type Optional<T> = {
  [P in keyof T]?: T[P];
};
```

### Advanced Example: Deep Readonly
```typescript
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object 
    ? DeepReadonly<T[P]> 
    : T[P];
};

interface User {
  name: string;
  address: {
    street: string;
    city: string;
  };
}

type ReadonlyUser = DeepReadonly<User>;
// All properties and nested properties are readonly
```

### Template Literal Types
```typescript
type EventName<T extends string> = `on${Capitalize<T>}`;

type ClickEvent = EventName<'click'>; // 'onClick'
type HoverEvent = EventName<'hover'>; // 'onHover'
```

## Module 3: Utility Types Deep Dive

### Built-in Utility Types
- `Pick<T, K>`: Select specific properties
- `Omit<T, K>`: Exclude specific properties  
- `Partial<T>`: Make all properties optional
- `Required<T>`: Make all properties required

### Custom Utility Types
```typescript
// Extract function parameter types
type Parameters<T extends (...args: any) => any> = 
  T extends (...args: infer P) => any ? P : never;

// Extract return type
type ReturnType<T extends (...args: any) => any> = 
  T extends (...args: any) => infer R ? R : any;

function getUserData(id: string, includePrivate: boolean): User {
  // implementation
}

type GetUserDataParams = Parameters<typeof getUserData>;
// [string, boolean]

type GetUserDataReturn = ReturnType<typeof getUserData>;
// User
```

## Practical Applications

### Form Validation Types
```typescript
type ValidationRule<T> = {
  [K in keyof T]: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  };
};

interface LoginForm {
  email: string;
  password: string;
}

const loginValidation: ValidationRule<LoginForm> = {
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    required: true,
    minLength: 8
  }
};
```

### API Client Types
```typescript
type ApiEndpoints = {
  '/users': { GET: User[]; POST: User };
  '/users/:id': { GET: User; PUT: User; DELETE: void };
  '/posts': { GET: Post[]; POST: Post };
};

type ApiClient = {
  [K in keyof ApiEndpoints]: {
    [M in keyof ApiEndpoints[K]]: (
      ...args: M extends 'GET' | 'DELETE' 
        ? [path: K] 
        : [path: K, data: ApiEndpoints[K][M]]
    ) => Promise<ApiEndpoints[K][M]>;
  };
};
```

## Personal Notes & Insights

### What's Clicking
- Conditional types are incredibly powerful for creating flexible APIs
- Template literal types open up amazing possibilities for type-safe string manipulation
- The combination of mapped types and conditional types can solve complex typing challenges

### Challenges #private
- Still struggling with deeply nested conditional types
- The syntax can get overwhelming quickly
- Need more practice with infer keyword usage
- Sometimes feel like I'm overengineering types when simpler solutions exist

### Real-World Applications
Planning to apply these patterns in our mobile app project:
1. **API Response Types**: Use conditional types for different response formats
2. **Form Validation**: Implement type-safe form validation with mapped types
3. **Event Handling**: Use template literal types for type-safe event names

### Questions for Team Discussion
- How do we balance type safety with development speed?
- When is it worth investing in complex type definitions?
- Best practices for maintaining complex type definitions?

## Next Steps

### Upcoming Modules
- [ ] Module 4: Advanced Generics
- [ ] Module 5: Declaration Merging
- [ ] Module 6: Compiler API
- [ ] Module 7: Performance Optimization
- [ ] Module 8: Real-World Project

### Practice Projects
- [ ] Build a type-safe ORM query builder
- [ ] Create a type-safe event emitter
- [ ] Implement a type-safe state management library

### Study Schedule
- **Monday/Wednesday/Friday**: 1 hour after work
- **Saturday**: 2-hour deep dive session
- **Target Completion**: February 15, 2024

## Resources & References

### Documentation
- [TypeScript Handbook - Advanced Types](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)
- [Utility Types Reference](https://www.typescriptlang.org/docs/handbook/utility-types.html)

### Community Resources
- [Type Challenges](https://github.com/type-challenges/type-challenges)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Matt Pocock's TypeScript Tips](https://www.totaltypescript.com/)

### Code Examples Repository
Created a GitHub repo to track all examples and exercises: `typescript-advanced-patterns-practice`

---
**Last Updated**: January 17, 2024  
**Next Review**: January 24, 2024  
**Confidence Level**: 7/10 