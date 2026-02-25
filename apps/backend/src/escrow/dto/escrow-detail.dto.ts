export class EscrowDetailResponseDto {
  escrowId: string;
  status: string;
  token: string;
  totalAmount: string;
  totalReleased: string;
  deadline: Date;

  depositor: {
    id: string;
  };

  recipient: {
    id: string;
  };

  milestones: {
    index: number;
    description: string;
    amount: string;
    status: string;
    releasedAt?: Date;
  }[];

  progressPercentage: number;
  isOverdue: boolean;

  createdAt: Date;
  updatedAt: Date;
  lastActionType?: string;
}
