import { IEscrow, IEscrowResponse, IEscrowFilters } from '@/types/escrow';

// Mock data for demonstration purposes
const MOCK_ESCROWS: IEscrow[] = [
  {
    id: '1',
    title: 'Website Development Project',
    description: 'Development of a responsive website with React and Node.js backend',
    amount: '1000',
    asset: 'XLM',
    creatorAddress: 'GABC...',
    counterpartyAddress: 'GDEF...',
    deadline: '2026-02-15T00:00:00Z',
    status: 'confirmed',
    createdAt: '2026-01-20T10:00:00Z',
    updatedAt: '2026-01-25T14:30:00Z',
  },
  {
    id: '2',
    title: 'Mobile App Design',
    description: 'UI/UX design for iOS and Android mobile application',
    amount: '500',
    asset: 'XLM',
    creatorAddress: 'GHIJ...',
    counterpartyAddress: 'GKLM...',
    deadline: '2026-03-01T00:00:00Z',
    status: 'created',
    createdAt: '2026-01-28T09:15:00Z',
    updatedAt: '2026-01-28T09:15:00Z',
  },
  {
    id: '3',
    title: 'Smart Contract Audit',
    description: 'Security audit of Ethereum smart contracts',
    amount: '2000',
    asset: 'XLM',
    creatorAddress: 'GNOP...',
    counterpartyAddress: 'GQRS...',
    deadline: '2026-02-28T00:00:00Z',
    status: 'completed',
    createdAt: '2026-01-15T11:45:00Z',
    updatedAt: '2026-01-30T16:20:00Z',
  },
  {
    id: '4',
    title: 'Content Writing Services',
    description: 'Technical blog posts and documentation writing',
    amount: '300',
    asset: 'XLM',
    creatorAddress: 'GTUV...',
    counterpartyAddress: 'GWXY...',
    deadline: '2026-02-10T00:00:00Z',
    status: 'disputed',
    createdAt: '2026-01-22T13:30:00Z',
    updatedAt: '2026-01-29T08:45:00Z',
  },
  {
    id: '5',
    title: 'Logo Design Package',
    description: 'Professional logo design with multiple revisions and variations',
    amount: '150',
    asset: 'XLM',
    creatorAddress: 'GAZY...',
    counterpartyAddress: 'GBXW...',
    deadline: '2026-02-20T00:00:00Z',
    status: 'funded',
    createdAt: '2026-01-25T16:20:00Z',
    updatedAt: '2026-01-27T09:10:00Z',
  },
  {
    id: '6',
    title: 'Video Editing Project',
    description: 'Professional video editing for corporate presentation',
    amount: '750',
    asset: 'XLM',
    creatorAddress: 'GCDE...',
    counterpartyAddress: 'GFHI...',
    deadline: '2026-03-15T00:00:00Z',
    status: 'released',
    createdAt: '2026-01-18T14:45:00Z',
    updatedAt: '2026-01-26T11:30:00Z',
  },
  {
    id: '7',
    title: 'Translation Services',
    description: 'Document translation from English to Spanish',
    amount: '120',
    asset: 'XLM',
    creatorAddress: 'GJKL...',
    counterpartyAddress: 'GMNO...',
    deadline: '2026-02-05T00:00:00Z',
    status: 'cancelled',
    createdAt: '2026-01-20T08:30:00Z',
    updatedAt: '2026-01-24T15:20:00Z',
  },
];

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class EscrowService {
  static async getEscrows(filters: IEscrowFilters = {}): Promise<IEscrowResponse> {
    await delay(800); // Simulate network delay
    
    const { status, search, sortBy, sortOrder, page = 1, limit = 10 } = filters;
    
    let filteredEscrows = [...MOCK_ESCROWS];
    
    // Apply status filter
    if (status && status !== 'all') {
      switch (status) {
        case 'active':
          filteredEscrows = filteredEscrows.filter(e => 
            ['created', 'funded', 'confirmed'].includes(e.status)
          );
          break;
        case 'pending':
          filteredEscrows = filteredEscrows.filter(e => e.status === 'confirmed');
          break;
        case 'completed':
          filteredEscrows = filteredEscrows.filter(e => e.status === 'completed');
          break;
        case 'disputed':
          filteredEscrows = filteredEscrows.filter(e => e.status === 'disputed');
          break;
      }
    }
    
    // Apply search filter
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredEscrows = filteredEscrows.filter(e =>
        e.title.toLowerCase().includes(searchTerm) ||
        e.counterpartyAddress.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply sorting
    if (sortBy) {
      filteredEscrows.sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'date':
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case 'amount':
            comparison = parseFloat(a.amount) - parseFloat(b.amount);
            break;
          case 'deadline':
            comparison = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
            break;
        }
        
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedEscrows = filteredEscrows.slice(startIndex, endIndex);
    
    return {
      escrows: paginatedEscrows,
      hasNextPage: endIndex < filteredEscrows.length,
      totalPages: Math.ceil(filteredEscrows.length / limit),
      totalCount: filteredEscrows.length,
    };
  }

  static async getEscrowById(id: string): Promise<IEscrow | null> {
    await delay(500); // Simulate network delay
    return MOCK_ESCROWS.find(escrow => escrow.id === id) || null;
  }

  static async createEscrow(data: Partial<IEscrow>): Promise<IEscrow> {
    await delay(1000); // Simulate network delay
    const newEscrow: IEscrow = {
      id: Math.random().toString(36).substr(2, 9),
      title: data.title || '',
      description: data.description || '',
      amount: data.amount || '',
      asset: data.asset || 'XLM',
      creatorAddress: data.creatorAddress || '',
      counterpartyAddress: data.counterpartyAddress || '',
      deadline: data.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'created',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return newEscrow;
  }

  static async updateEscrowStatus(id: string, status: IEscrow['status']): Promise<IEscrow | null> {
    await delay(500); // Simulate network delay
    const escrow = MOCK_ESCROWS.find(e => e.id === id);
    if (escrow) {
      escrow.status = status;
      escrow.updatedAt = new Date().toISOString();
      return escrow;
    }
    return null;
  }
}