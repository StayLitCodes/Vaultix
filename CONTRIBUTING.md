# Contributing to Vaultix

Thank you for your interest in contributing to Vaultix! This document provides guidelines and workflows for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in your interactions with others.

## Getting Started

### 1. Fork and Clone

```bash
git clone https://github.com/your-username/vaultix.git
cd vaultix
```

### 2. Set Up Development Environment

Follow the setup instructions in [README.md](README.md) to install dependencies and configure your environment:

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/backend/.env.example apps/backend/.env
# Edit .env with your configuration

# Run database migrations
cd apps/backend && pnpm typeorm migration:run
```

### 3. Find an Issue

Browse our [GitHub Issues](https://github.com/Vaultix/vaultix/issues) to find something to work on:

- **Good First Issue**: Perfect for newcomers - well-scoped tasks with clear requirements
- **Help Wanted**: Tasks that need community assistance
- **Priority: High**: Important issues for the roadmap

**Tip**: Comment on an issue before starting to ensure it's available and no one else is working on it.

## Development Workflow

### Branch Naming Convention

Use descriptive branch names with conventional commit prefixes:

```bash
feat/add-milestone-notifications      # New features
fix/escrow-deadline-calculation       # Bug fixes
docs/update-setup-instructions        # Documentation only
refactor/auth-service-cleanup         # Code refactoring
test/add-escrow-e2e-tests            # Adding tests
chore/update-dependencies             # Maintenance tasks
```

**Examples:**
- `feat/add-dispute-resolution-modal`
- `fix/wallet-connection-timeout`
- `docs/contributing-guidelines`

### Making Changes

1. **Create a branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make incremental commits**: Small, focused commits are easier to review

3. **Write tests**: Add tests for new functionality

4. **Run checks locally**:
   ```bash
   pnpm turbo run lint test build
   ```

5. **Keep your branch updated**:
   ```bash
   git fetch origin main
   git rebase origin main
   ```

### Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(escrow): add milestone notification system

- Implement email notifications for milestone updates
- Add notification preferences to user settings
- Create notification entity and service

Closes #123
```

```
fix(auth): resolve JWT expiration handling

Properly refresh expired tokens instead of forcing re-login

Fixes #456
```

```
docs(readme): update installation instructions

Add detailed prerequisites section and troubleshooting tips
```

## Pull Request Guidelines

### Before Submitting

Ensure your PR meets these criteria:

- [ ] **Tests**: Added/updated unit or E2E tests for new functionality
- [ ] **Linting**: Code passes `pnpm turbo run lint` with no errors
- [ ] **TypeScript**: No type errors (`pnpm turbo run type-check` if configured)
- [ ] **Build**: Project builds successfully (`pnpm turbo run build`)
- [ ] **Description**: Clear description explaining the "what" and "why"
- [ ] **Issue Link**: Reference related GitHub issue (e.g., "Closes #123")
- [ ] **Screenshots**: For UI changes, include before/after screenshots
- [ ] **Documentation**: Updated relevant docs if changing behavior
- [ ] **Breaking Changes**: Clearly marked with migration notes

### PR Template

When creating a PR, use this template:

```markdown
## Description
Brief description of changes and what problem this solves

## Related Issue
Closes #123

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Testing Done
- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manually tested locally

## Screenshots (if UI changes)
Before: [screenshot]
After: [screenshot]

## Checklist
- [ ] My code follows the project's coding standards
- [ ] I have run lint and tests locally
- [ ] I have updated documentation as needed
- [ ] I have read the CONTRIBUTING.md file
```

### Review Process

1. **Automated Checks**: CI runs lint, tests, and build
2. **Code Review**: Maintainers review within 2-3 days
3. **Address Feedback**: Push new commits to address reviewer comments
4. **Merge**: PR is squashed and merged to `main`

## Coding Standards

### TypeScript/JavaScript (Backend & Frontend)

- Use TypeScript for all new code
- Follow ESLint configuration (`.eslintrc.json` / `eslint.config.js`)
- Use Prettier for formatting (`.prettierrc`)
- Prefer async/await for asynchronous code
- Use meaningful variable names

**Example:**

```typescript
/**
 * Creates a new escrow agreement
 * @param data - Escrow configuration
 * @returns The created escrow entity
 * @throws EscrowValidationError if data is invalid
 */
async createEscrow(data: CreateEscrowDto): Promise<Escrow> {
  // Validate input
  await this.validateEscrowData(data);
  
  // Create escrow record
  const escrow = await this.escrowRepository.create(data);
  
  // Emit event
  await this.eventEmitter.emit('escrow.created', escrow);
  
  return escrow;
}
```

### Rust (Smart Contracts)

- Follow Rust best practices and idioms
- Run `cargo fmt` and `cargo clippy` before committing
- Include comprehensive tests for contract functions
- Document public functions with rustdoc comments

**Example:**

```rust
/// Creates a new escrow contract instance
///
/// # Arguments
/// * `depositor` - The address depositing funds
/// * `recipient` - The address receiving funds
/// * `amount` - The amount to escrow
///
/// # Returns
/// The created escrow ID
///
/// # Errors
/// Returns Error if deposit fails or conditions are invalid
#[contractmethod]
pub fn create_escrow(
    e: &Env,
    depositor: Address,
    recipient: Address,
    amount: i128,
) -> Result<u64, Error> {
    // Implementation
}
```

### File Structure

Organize code logically following the existing structure:

**Backend:**
```
apps/backend/src/
├── modules/        # Feature modules (auth, escrow, stellar, etc.)
├── entities/       # TypeORM database entities
├── guards/         # Auth & authorization guards
├── middleware/     # Custom middleware
├── services/       # Business logic
└── utils/          # Shared utilities
```

**Frontend:**
```
apps/frontend/
├── app/            # Next.js app router pages
├── components/     # React components
├── hooks/          # Custom React hooks
├── lib/            # Utilities & API clients
├── services/       # Business logic services
└── types/          # TypeScript type definitions
```

### Naming Conventions

- **Files**: kebab-case (`user-service.ts`, `escrow-form.tsx`)
- **Classes**: PascalCase (`UserService`, `EscrowController`)
- **Functions/Variables**: camelCase (`getUserById`, `escrowData`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `JWT_SECRET`)
- **Types/Interfaces**: PascalCase (`UserResponse`, `EscrowConfig`)

## Testing

### Running Tests

```bash
# All tests across monorepo
pnpm turbo run test

# Backend tests only
cd apps/backend && pnpm test

# Frontend tests only
cd apps/frontend && pnpm test

# E2E tests
pnpm turbo run test:e2e

# Contract tests
cd apps/onchain && cargo test
```

### Writing Tests

**Backend Unit Test** (Jest):

```typescript
describe('EscrowService', () => {
  let service: EscrowService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EscrowService],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
  });

  it('should create escrow with valid data', async () => {
    const escrowData = {
      amount: 100,
      recipient: 'test-address',
      milestones: ['Milestone 1'],
    };
    
    const result = await service.create(escrowData);
    
    expect(result).toBeDefined();
    expect(result.status).toBe('pending');
    expect(result.amount).toBe(100);
  });

  it('should reject escrow with invalid amount', async () => {
    const invalidData = { /* ... */ };
    
    await expect(service.create(invalidData))
      .rejects
      .toThrow(EscrowValidationError);
  });
});
```

**Frontend Component Test** (React Testing Library):

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateEscrowForm } from '@/components/escrow/create-escrow-form';

describe('CreateEscrowForm', () => {
  it('submits form with valid data', async () => {
    const mockSubmit = jest.fn();
    
    render(<CreateEscrowForm onSubmit={mockSubmit} />);
    
    // Fill form
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: '100' }
    });
    
    fireEvent.change(screen.getByLabelText(/recipient/i), {
      target: { value: 'GABC...DEF' }
    });
    
    // Submit
    fireEvent.click(screen.getByText('Create Escrow'));
    
    // Wait for submission
    await screen.findByText(/escrow created successfully/i);
    
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 100,
        recipient: 'GABC...DEF'
      })
    );
  });

  it('shows validation errors for invalid input', async () => {
    render(<CreateEscrowForm onSubmit={jest.fn()} />);
    
    // Submit empty form
    fireEvent.click(screen.getByText('Create Escrow'));
    
    expect(await screen.findByText(/amount is required/i))
      .toBeInTheDocument();
  });
});
```

**Contract Test** (Soroban):

```rust
#[test]
fn test_create_escrow() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, VaultixEscrow);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let amount = 1000_000_000; // 1 XLM in stroops
    
    // Create escrow
    let escrow_id = VaultixEscrowClient::new(&env, &contract_id)
        .create_escrow(&depositor, &recipient, &amount);
    
    // Verify escrow was created
    let escrow = VaultixEscrowClient::new(&env, &contract_id)
        .get_escrow(&escrow_id);
    
    assert_eq!(escrow.depositor, depositor);
    assert_eq!(escrow.recipient, recipient);
    assert_eq!(escrow.amount, amount);
}
```

### Test Coverage Goals

Aim for high coverage on critical paths:
- ✅ Authentication flows (wallet connect, JWT)
- ✅ Escrow creation and fund release
- ✅ Milestone tracking and approval
- ✅ Dispute resolution workflow
- ✅ Smart contract functions

## Documentation

### Code Comments

**TypeScript (JSDoc):**

```typescript
/**
 * Validates and processes escrow milestone completion
 * 
 * @param escrowId - The ID of the escrow to update
 * @param milestoneIndex - Index of the milestone to complete
 * @param proofData - Optional proof of milestone completion
 * 
 * @returns Updated escrow entity
 * 
 * @throws {NotFoundError} If escrow doesn't exist
 * @throws {InvalidStateError} If escrow is not in active state
 */
async completeMilestone(
  escrowId: string,
  milestoneIndex: number,
  proofData?: string
): Promise<Escrow> {
  // Implementation
}
```

**Rust (rustdoc):**

```rust
/// Releases funds from escrow to the recipient
///
/// This function can only be called when:
/// - All milestones are completed, OR
/// - Arbitrator approves early release
///
/// # Arguments
/// * `escrow_id` - The ID of the escrow to release
/// * `caller` - Address of the caller (must be authorized)
///
/// # Returns
/// Transaction hash of the release transaction
///
/// # Errors
/// Returns `Error::Unauthorized` if caller is not authorized
/// Returns `Error::InvalidState` if escrow conditions not met
#[contractmethod]
pub fn release_funds(e: &Env, escrow_id: u64, caller: Address) 
    -> Result<Bytes, Error> {
    // Implementation
}
```

### Updating README

Update README.md when:
- Adding new features or capabilities
- Changing setup requirements or prerequisites
- Modifying architecture or repository structure
- Adding new configuration options
- Updating deployment instructions

## Monorepo Tips

### Filtering Commands

```bash
# Build only backend
pnpm turbo run build --filter=backend

# Build backend and its dependencies
pnpm turbo run build --filter=backend...

# Run dev server for frontend only
pnpm turbo run dev --filter=frontend

# Test specific app
pnpm turbo run test --filter=@vaultix/backend
```

### Adding Dependencies

```bash
# Add to specific app
cd apps/backend && pnpm add @nestjs/config

# Add dev dependency to frontend
cd apps/frontend && pnpm add -D @types/node

# Add to workspace root (shared)
pnpm add axios
```

## Questions?

- **Discord**: Join our [Discord server](https://discord.gg/vaultix)
- **GitHub Discussions**: Ask in [Discussions](https://github.com/Vaultix/vaultix/discussions)
- **Issues**: Open an issue for bugs or feature requests

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Annual contributor spotlight

## What We're Looking For

**High Priority Contributions:**
- ✅ Bug fixes (especially issues labeled `bug` or `priority: high`)
- ✅ Test coverage improvements
- ✅ Documentation enhancements
- ✅ Performance optimizations
- ✅ Accessibility improvements
- ✅ Security enhancements

**Post-MVP Features** (discuss before implementing):
- Multi-asset support (custom tokens, USDC)
- Advanced analytics dashboard
- Mobile applications
- Additional notification channels (SMS, Telegram)
- Fiat on/off ramps

Thank you for contributing to Vaultix! 🚀

Together, we're building a more secure and trustless future for peer-to-peer transactions on Stellar.
