import { renderHook, act } from '@testing-library/react-native';
import { useDisputes } from '../hooks/useDisputes';

describe('useDisputes', () => {
  it('raises a dispute correctly', async () => {
    const { result } = renderHook(() => useDisputes());
    
    let res: Awaited<ReturnType<typeof result.current.raiseDispute>> | undefined;
    await act(async () => {
      res = await result.current.raiseDispute('escrow-1', 'Reason', 'Description');
    });

    expect(res?.success).toBe(true);
    expect(result.current.hasActiveDispute).toBe(true);
    expect(result.current.dispute?.status).toBe('OPEN');
  });
});
